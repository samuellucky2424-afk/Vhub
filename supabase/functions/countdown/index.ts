import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SMSPOOL_API_KEY = Deno.env.get("SMSPOOL_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
    }
});

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const COUNTDOWN_DURATION = 120000; // 120 seconds

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    try {
        const payload = await req.json();
        const { action, order_id, smspool_order_id, user_id } = payload;

        console.log(`[Countdown] Received: ${action}`, payload);

        if (action === 'start_countdown') {
            if (!order_id || !smspool_order_id || !user_id) {
                return new Response(JSON.stringify({ 
                    success: false, 
                    message: 'Missing order_id, smspool_order_id, or user_id' 
                }), { 
                    status: 400, 
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
                });
            }

            // Start countdown and polling in background
            const log = (msg: string) => console.log(`[COUNTDOWN] ${msg}`);
            log(`Starting 80s countdown for order ${order_id}`);

            const startTime = Date.now();
            let foundCode: string | null = null;
            let finalStatus: string | null = null;
            let pollCount = 0;

            while (Date.now() - startTime < COUNTDOWN_DURATION) {
                const elapsed = Date.now() - startTime;
                const remaining = Math.round((COUNTDOWN_DURATION - elapsed) / 1000);
                const pollInterval = 1000; // Poll every 1 second
                pollCount++;

                // Log at key intervals
                if ([60, 30, 10, 5, 1].includes(remaining)) {
                    log(`${remaining}s remaining for order ${order_id}`);
                }

                try {
                    const checkUrl = `https://api.smspool.net/sms/check?key=${SMSPOOL_API_KEY}&orderid=${smspool_order_id}`;
                    const response = await fetch(checkUrl);
                    const data = await response.json();

                    if ((data.status === 3 || data.status === 'completed') && data.sms) {
                        foundCode = data.sms;
                        finalStatus = 'completed';
                        log(`OTP found: ${foundCode}`);
                        break;
                    }

                    if (data.status === 6 || data.status === 2 || data.status === 'refunded') {
                        finalStatus = 'refunded';
                        log(`Order refunded`);
                        break;
                    }
                } catch (err) {
                    log(`Poll error: ${err.message}`);
                }

                await new Promise(resolve => setTimeout(resolve, pollInterval));
            }

            // Handle timeout
            if (!foundCode && !finalStatus) {
                log(`TIMEOUT! Cancelling order ${order_id}`);
                
                // Cancel on SMSPool
                let cancelSuccess = false;
                try {
                    const cancelUrl = `https://api.smspool.net/sms/cancel?key=${SMSPOOL_API_KEY}&orderid=${smspool_order_id}`;
                    log(`Calling cancel URL: ${cancelUrl.replace(SMSPOOL_API_KEY, '***')}`);
                    
                    const cancelResponse = await fetch(cancelUrl);
                    const cancelData = await cancelResponse.json();
                    
                    log(`SMSPool cancel response: ${JSON.stringify(cancelData)}`);
                    
                    if (cancelData.success === 1 || cancelData.success === true) {
                        log(`✅ Successfully cancelled SMSPool order ${smspool_order_id}`);
                        cancelSuccess = true;
                    } else {
                        log(`⚠️ SMSPool cancel returned success=false: ${cancelData.message || 'Unknown error'}`);
                    }
                } catch (e) {
                    log(`❌ Cancel error: ${e.message}`);
                }

                // Refund user
                try {
                    const { data: order } = await supabase.from('orders').select('price').eq('id', order_id).single();
                    if (order?.price) {
                        const refundAmount = Math.floor(order.price * 100);
                        await supabase.rpc('credit_user_wallet', {
                            p_user_id: user_id,
                            p_amount: refundAmount,
                            p_description: `Auto-refund for timeout order ${order_id}`,
                            p_reference: `timeout-refund-${order_id}-${Date.now()}`
                        });
                        log(`Refunded ${refundAmount} kobo to user ${user_id}`);
                    }
                } catch (e) {
                    log(`Refund error: ${e.message}`);
                }

                // Update order
                await supabase.from('orders').update({
                    status: 'refunded',
                    metadata: { timeout_cancelled: true, timeout_at: new Date().toISOString() }
                }).eq('id', order_id);

                return new Response(JSON.stringify({
                    success: false,
                    timeout: true,
                    message: 'Order timed out after 80s - cancelled and refunded'
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            // Success
            if (foundCode) {
                await supabase.from('orders').update({
                    status: 'completed',
                    payment_status: 'completed',
                    sms_code: foundCode,
                    metadata: { completed_at: new Date().toISOString() }
                }).eq('id', order_id);

                await supabase.from('verifications').update({
                    otp_code: foundCode,
                    received_at: new Date().toISOString()
                }).eq('order_id', order_id);

                return new Response(JSON.stringify({
                    success: true,
                    order_id: order_id,
                    smspool_order_id: smspool_order_id.toString(),
                    message: 'OTP received successfully'
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            return new Response(JSON.stringify({
                success: false,
                message: 'Order ended without OTP'
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (action === 'get_countdown_status') {
            if (!order_id) {
                return new Response(JSON.stringify({ success: false, message: 'Missing order_id' }), { 
                    status: 400, 
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
                });
            }

            const { data: order, error } = await supabase.from('orders').select('*').eq('id', order_id).single();
            
            if (error || !order) {
                return new Response(JSON.stringify({ success: false, message: 'Order not found' }), { 
                    status: 404, 
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
                });
            }

            const orderCreatedAt = new Date(order.created_at).getTime();
            const currentTime = Date.now();
            const totalDuration = 120000;
            const elapsed = currentTime - orderCreatedAt;
            const remaining = Math.max(0, totalDuration - elapsed);
            const percentage = Math.min(Math.round((elapsed / totalDuration) * 100), 100);

            const isActive = order.status !== 'completed' && order.status !== 'refunded' && order.status !== 'failed' && remaining > 0;

            return new Response(JSON.stringify({
                success: true,
                order_id: order_id,
                status: order.status,
                countdown: {
                    active: isActive,
                    total_duration: totalDuration,
                    elapsed: elapsed,
                    remaining: remaining,
                    percentage: percentage,
                    time_remaining_seconds: Math.round(remaining / 1000),
                    time_elapsed_seconds: Math.round(elapsed / 1000),
                    message: isActive ? 'Waiting for OTP...' : 
                            order.status === 'completed' ? 'OTP received' : 
                            order.status === 'refunded' ? 'Order refunded' : 'Order completed'
                },
                order_details: {
                    phone_number: order.phone_number,
                    service_type: order.metadata?.serviceId,
                    country_id: order.metadata?.countryId,
                    created_at: order.created_at,
                    payment_status: order.payment_status
                }
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        return new Response("Invalid action", { status: 400, headers: corsHeaders });

    } catch (err) {
        console.error(err);
        return new Response(JSON.stringify({ error: err.message }), { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
    }
});
