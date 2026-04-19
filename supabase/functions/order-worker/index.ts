import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SMSPOOL_API_KEY = Deno.env.get("SMSPOOL_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ORDER_TIMEOUT_MS = Number(Deno.env.get("ORDER_TIMEOUT_MS") || "180000"); // 3 minutes default
const POLL_INTERVAL_MS = Number(Deno.env.get("POLL_INTERVAL_MS") || "5000"); // 5 seconds
const MAX_POLL_RETRIES = Number(Deno.env.get("MAX_POLL_RETRIES") || "3");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const log = (msg: string, data?: any) => {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [WORKER] ${msg}${data ? ' ' + JSON.stringify(data) : ''}`;
  console.log(logEntry);
};

interface SMSPoolResponse {
  success?: number;
  status?: number | string;
  number?: string;
  phonenumber?: string;
  sms?: string;
  full_sms?: string;
  message?: string;
}

async function checkSMSPoolStatus(smspoolOrderId: string): Promise<{
  status: number;
  smsCode: string | null;
  fullSms: string | null;
  message: string | null;
}> {
  const url = `https://api.smspool.net/sms/check?key=${SMSPOOL_API_KEY}&orderid=${smspoolOrderId}`;
  log(`Checking SMSPool status`, { smspoolOrderId, url: url.replace(SMSPOOL_API_KEY, '***') });

  try {
    const response = await fetch(url);
    const data: SMSPoolResponse = await response.json();

    log(`SMSPool response`, { smspoolOrderId, status: data.status, sms: data.sms ? '***' : null });

    return {
      status: typeof data.status === 'string' ? parseInt(data.status) || 0 : data.status || 0,
      smsCode: data.sms || null,
      fullSms: data.full_sms || data.sms || null,
      message: data.message || null
    };
  } catch (error) {
    log(`SMSPool API error`, { smspoolOrderId, error: error.message });
    throw error;
  }
}

async function updateOrderStatus(
  orderId: string,
  newStatus: string,
  smspoolStatus: number | null,
  smspoolMessage: string | null,
  smsCode: string | null,
  additionalMetadata: Record<string, any> = {}
) {
  const { data: order } = await supabase.from('orders').select('status').eq('id', orderId).single();
  const previousStatus = order?.status;

  const updateData: any = {
    status: newStatus,
    last_polled_at: new Date().toISOString(),
    poll_count: supabase.raw('poll_count + 1')
  };

  if (smsCode) {
    updateData.sms_code = smsCode;
    updateData.metadata = supabase.raw(`COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify({ latest_sms_code: smsCode, smspool_status: smspoolStatus })}`);
  }

  if (newStatus === 'completed') {
    updateData.completed_at = new Date().toISOString();
  }

  if (Object.keys(additionalMetadata).length > 0) {
    updateData.metadata = supabase.raw(`COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify(additionalMetadata)}`);
  }

  await supabase.from('orders').update(updateData).eq('id', orderId);

  await supabase.from('order_status_logs').insert({
    order_id: orderId,
    previous_status: previousStatus,
    new_status: newStatus,
    smspool_status: smspoolStatus,
    smspool_message: smspoolMessage,
    sms_code: smsCode
  });

  log(`Order status updated`, { orderId, previousStatus, newStatus, smspoolStatus });
}

async function refundOrder(orderId: string, userId: string, amountKobo: number) {
  log(`Refunding order`, { orderId, userId, amountKobo });

  try {
    await supabase.rpc('credit_user_wallet', {
      p_user_id: userId,
      p_amount: amountKobo,
      p_description: `Auto-refund for timeout order ${orderId}`,
      p_reference: `timeout-refund-${orderId}-${Date.now()}`
    });
    log(`Refund successful`, { orderId });
  } catch (error) {
    log(`Refund failed`, { orderId, error: error.message });
  }
}

async function cancelSMSPoolOrder(smspoolOrderId: string): Promise<boolean> {
  try {
    const url = `https://api.smspool.net/sms/cancel?key=${SMSPOOL_API_KEY}&orderid=${smspoolOrderId}`;
    const response = await fetch(url);
    const data = await response.json();
    return data.success === 1 || data.success === true;
  } catch (error) {
    log(`SMSPool cancel failed`, { smspoolOrderId, error: error.message });
    return false;
  }
}

async function processOrder(order: any): Promise<void> {
  const { id: orderId, request_id: smspoolOrderId, status, user_id: userId, price_kobo: priceKobo } = order;

  log(`Processing order`, { orderId, smspoolOrderId, currentStatus: status });

  try {
    const result = await checkSMSPoolStatus(smspoolOrderId);
    const { status: smspoolStatus, smsCode, fullSms, message } = result;

    switch (smspoolStatus) {
      case 1:
        if (status === 'processing') {
          await updateOrderStatus(orderId, 'number_received', smspoolStatus, message, null, { phone_number: order.phone_number });
        } else if (status === 'number_received') {
          await updateOrderStatus(orderId, 'waiting_sms', smspoolStatus, message, null);
        }
        break;

      case 3:
        if (smsCode) {
          await updateOrderStatus(orderId, 'completed', smspoolStatus, message, smsCode);
          await supabase.from('verifications').upsert({
            order_id: orderId,
            user_id: userId,
            otp_code: smsCode,
            full_sms: fullSms,
            received_at: new Date().toISOString()
          }, { onConflict: 'order_id' });
          log(`Order completed with OTP`, { orderId, smsCode: smsCode.substring(0, 3) + '***' });
        }
        break;

      case 2:
      case 6:
        await updateOrderStatus(orderId, 'refunded', smspoolStatus, message, null, { refund_reason: 'smspool_cancelled' });
        if (priceKobo && priceKobo > 0) {
          await refundOrder(orderId, userId, priceKobo);
        }
        break;

      case 5:
        await updateOrderStatus(orderId, 'failed', smspoolStatus, message, null, { failure_reason: 'smspool_failed' });
        break;

      default:
        log(`Unknown SMSPool status`, { orderId, smspoolStatus });
    }
  } catch (error) {
    log(`Error processing order`, { orderId, error: error.message });
    const retryCount = (order.retry_count || 0) + 1;
    if (retryCount >= MAX_POLL_RETRIES) {
      await updateOrderStatus(orderId, 'failed', null, 'Max retries exceeded', null, { error: error.message });
      if (priceKobo && priceKobo > 0) {
        await refundOrder(orderId, userId, priceKobo);
      }
    } else {
      await supabase.from('orders').update({ retry_count: retryCount }).eq('id', orderId);
    }
  }
}

async function processTimedOutOrders(): Promise<number> {
  log(`Checking for timed out orders`);

  const { data: timedOutOrders, error } = await supabase.rpc('get_timed_out_orders', { p_limit: 50 });

  if (error || !timedOutOrders?.length) {
    return 0;
  }

  log(`Found ${timedOutOrders.length} timed out orders`);

  for (const order of timedOutOrders) {
    const { id: orderId, request_id: smspoolOrderId, user_id: userId, price_kobo: priceKobo } = order;

    await cancelSMSPoolOrder(smspoolOrderId);
    await updateOrderStatus(orderId, 'refunded', null, 'Order timed out', null, { timeout_refund: true });

    if (priceKobo && priceKobo > 0) {
      await refundOrder(orderId, userId, priceKobo);
    }
  }

  return timedOutOrders.length;
}

async function pollActiveOrders(): Promise<{ processed: number; completed: number; failed: number; refunded: number }> {
  log(`Polling active orders`);

  const { data: orders, error } = await supabase.rpc('get_orders_needing_poll', { p_limit: 50 });

  if (error || !orders?.length) {
    return { processed: 0, completed: 0, failed: 0, refunded: 0 };
  }

  log(`Found ${orders.length} orders needing poll`);

  let completed = 0, failed = 0, refunded = 0;

  for (const order of orders) {
    const previousStatus = order.status;
    await processOrder(order);

    const { data: updatedOrder } = await supabase.from('orders').select('status').eq('id', order.id).single();
    if (updatedOrder?.status === 'completed') completed++;
    else if (updatedOrder?.status === 'failed') failed++;
    else if (updatedOrder?.status === 'refunded') refunded++;
  }

  return { processed: orders.length, completed, failed, refunded };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json().catch(() => ({}));
    const { action } = payload;

    log(`Received action`, { action });

    if (action === 'poll') {
      const result = await pollActiveOrders();
      log(`Poll complete`, result);
      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'check_timeouts') {
      const count = await processTimedOutOrders();
      log(`Timeout check complete`, { processed: count });
      return new Response(JSON.stringify({ success: true, processed: count }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'process_single') {
      const { order_id } = payload;
      if (!order_id) {
        return new Response(JSON.stringify({ success: false, message: 'Missing order_id' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: order, error } = await supabase.from('orders').select('*').eq('id', order_id).single();
      if (error || !order) {
        return new Response(JSON.stringify({ success: false, message: 'Order not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      await processOrder(order);
      return new Response(JSON.stringify({ success: true, message: 'Order processed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: false, message: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    log(`Worker error`, { error: error.message, stack: error.stack });
    return new Response(JSON.stringify({ success: false, message: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
