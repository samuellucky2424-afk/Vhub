// Clean countdown API implementation to replace the problematic section
if (action === 'get_order_countdown') {
    const { order_id } = payload;
    if (!order_id) {
        return new Response(JSON.stringify({ success: false, message: 'Missing order_id' }), { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
    }

    const log = (msg: string) => console.log(`[COUNTDOWN_API] ${msg}`);
    log(`Getting countdown for order ${order_id}`);

    try {
        const { data: order, error: orderErr } = await supabase
            .from('orders')
            .select('*')
            .eq('id', order_id)
            .single();

        if (orderErr || !order) {
            log(`Order not found: ${orderErr?.message}`);
            return new Response(JSON.stringify({ success: false, message: 'Order not found' }), { 
                status: 404, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            });
        }

        if (order.status === 'completed' || order.status === 'refunded' || order.status === 'failed') {
            return new Response(JSON.stringify({
                success: true,
                order_id: order_id,
                status: order.status,
                countdown: {
                    active: false,
                    message: order.status === 'completed' ? 'OTP received' : 
                           order.status === 'refunded' ? 'Order refunded' : 'Order failed',
                    final_status: order.status
                }
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const countdownStarted = order.metadata?.countdown_started_at;
        const orderCreatedAt = new Date(order.created_at).getTime();
        const currentTime = Date.now();
        
        let countdownData = {
            active: true,
            total_duration: 80000,
            elapsed: 0,
            remaining: 80000,
            percentage: 0,
            started_at: countdownStarted || order.created_at,
            order_created_at: order.created_at
        };

        if (countdownStarted) {
            const startedTime = new Date(countdownStarted).getTime();
            countdownData.elapsed = currentTime - startedTime;
            countdownData.remaining = Math.max(0, countdownData.total_duration - countdownData.elapsed);
            countdownData.percentage = Math.round((countdownData.elapsed / countdownData.total_duration) * 100);
        } else {
            countdownData.elapsed = currentTime - orderCreatedAt;
            countdownData.remaining = Math.max(0, countdownData.total_duration - countdownData.elapsed);
            countdownData.percentage = Math.round((countdownData.elapsed / countdownData.total_duration) * 100);
            
            await supabase.from('orders').update({
                metadata: {
                    ...order.metadata,
                    countdown_started_at: new Date().toISOString(),
                    countdown_total_duration: 80000
                }
            }).eq('id', order_id);
            
            log(`Countdown started for order ${order_id}`);
        }

        if (order.request_id) {
            try {
                const checkUrl = `https://api.smspool.net/sms/check?key=${SMSPOOL_API_KEY}&orderid=${order.request_id}`;
                const response = await fetch(checkUrl);
                const data = await response.json();
                
                if (data.status === 3 && data.sms) {
                    countdownData.active = false;
                    countdownData.message = 'OTP received';
                    countdownData.final_status = 'completed';
                    countdownData.otp_code = data.sms;
                } else if (data.status === 6) {
                    countdownData.active = false;
                    countdownData.message = 'Order refunded';
                    countdownData.final_status = 'refunded';
                } else if (data.status === 2) {
                    countdownData.active = false;
                    countdownData.message = 'Order failed';
                    countdownData.final_status = 'failed';
                }
            } catch (err) {
                log(`Failed to check SMSPool status: ${err.message}`);
            }
        }

        const response = {
            success: true,
            order_id: order_id,
            status: order.status,
            countdown: {
                active: countdownData.active,
                total_duration: countdownData.total_duration,
                elapsed: Math.round(countdownData.elapsed),
                remaining: Math.round(countdownData.remaining),
                percentage: countdownData.percentage,
                time_remaining_seconds: Math.round(countdownData.remaining / 1000),
                time_elapsed_seconds: Math.round(countdownData.elapsed / 1000),
                started_at: countdownData.started_at,
                order_created_at: order.created_at,
                message: countdownData.message || 'Waiting for OTP...',
                final_status: countdownData.final_status || null,
                otp_code: countdownData.otp_code || null
            },
            order_details: {
                phone_number: order.phone_number,
                service_type: order.metadata?.serviceId,
                country_id: order.metadata?.countryId,
                created_at: order.created_at,
                payment_status: order.payment_status
            }
        };

        log(`Countdown data for order ${order_id}: active=${countdownData.active}, remaining=${Math.round(countdownData.remaining/1000)}s`);

        return new Response(JSON.stringify(response), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        log(`Error getting countdown: ${error.message}`);
        return new Response(JSON.stringify({ success: false, message: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}
