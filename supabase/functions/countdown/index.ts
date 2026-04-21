import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SMSPOOL_API_KEY = Deno.env.get("SMSPOOL_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ORDER_TIMEOUT_MS = Number(Deno.env.get("ORDER_TIMEOUT_MS") || "300000");
const COUNTDOWN_POLL_INTERVAL_MS = Number(Deno.env.get("COUNTDOWN_POLL_INTERVAL_MS") || "2000");

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

const COUNTDOWN_DURATION = ORDER_TIMEOUT_MS; // 5 minutes by default

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
            log(`Starting TextVerified countdown for order ${order_id}`);

            const startTime = Date.now();
            let finalStatus: string | null = null;

            while (Date.now() - startTime < COUNTDOWN_DURATION + 10000) { // Add 10s buffer for the cancellation check 
                const elapsed = Date.now() - startTime;
                const remaining = Math.round((COUNTDOWN_DURATION - elapsed) / 1000);
                const pollInterval = COUNTDOWN_POLL_INTERVAL_MS; // Poll aggressively for fast OTP pickup

                // Log at key intervals
                if ([60, 30, 10, 5, 1].includes(Math.round(remaining / 5) * 5)) {
                    log(`${remaining}s remaining for order ${order_id}`);
                }

                try {
                    // Call the textverify-service sync_order_status which has all the logic!
                    const checkUrl = `${SUPABASE_URL}/functions/v1/textverify-service`;
                    const response = await fetch(checkUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
                        },
                        body: JSON.stringify({
                            action: 'sync_order_status',
                            order_id: order_id
                        })
                    });
                    
                    const data = await response.json();
                    
                    if (data.new_status === 'completed') {
                        finalStatus = 'completed';
                        log(`OTP successfully found and stored by textverify-service for order: ${order_id}`);
                        break;
                    }

                    if (data.new_status === 'refunded' || data.new_status === 'failed' || data.new_status === 'cancelled') {
                        finalStatus = 'refunded';
                        log(`Order was refunded/cancelled by textverify-service`);
                        break;
                    }
                } catch (err: any) {
                    log(`Poll error: ${err.message}`);
                }

                await new Promise(resolve => setTimeout(resolve, pollInterval));
            }

            if (!finalStatus) {
                log(`TIMEOUT! The order didn't finish within the window. TextVerify-Service should handle auto-refunds on next sync.`);
                return new Response(JSON.stringify({
                    success: false,
                    timeout: true,
                    message: 'Order timed out'
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            return new Response(JSON.stringify({
                success: true,
                order_id: order_id,
                message: `Order finished with status: ${finalStatus}`
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

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
            const totalDuration = COUNTDOWN_DURATION;
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
