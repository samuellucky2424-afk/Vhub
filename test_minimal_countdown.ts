// Minimal version to test the syntax
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { action } = await req.json();
        
        if (action === 'get_order_countdown') {
            const { order_id } = await req.json();
            
            if (!order_id) {
                return new Response(JSON.stringify({ 
                    success: false, 
                    message: 'Missing order_id' 
                }), { 
                    status: 400, 
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
                });
            }

            // Simple response
            const response = {
                success: true,
                order_id: order_id,
                countdown: {
                    active: true,
                    total_duration: 80000,
                    time_remaining_seconds: 75,
                    message: "Waiting for OTP..."
                }
            };

            return new Response(JSON.stringify(response), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        return new Response("Invalid action", { status: 400, headers: corsHeaders });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
    }
});
