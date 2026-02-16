import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("MY_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // 1. Get User from Auth Header
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'No authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Validate JWT
        const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        if (authError || !user) {
            return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const { amount } = await req.json();

        // 2. Validate Amount
        if (!amount || amount < 100) { // Minimum 100 NGN
            return new Response(JSON.stringify({ error: 'Invalid amount. Minimum is 100 NGN.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const email = user.email;
        const amountKobo = Math.round(amount * 100);
        const reference = `fund_${user.id}_${Date.now()}`;

        // 3. Initialize Paystack Transaction (for inline popup)
        const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email,
                amount: amountKobo,
                reference,
                metadata: {
                    type: 'wallet_funding',
                    user_id: user.id,
                    custom_fields: [
                        {
                            display_name: "Action",
                            variable_name: "action",
                            value: "wallet_funding"
                        }
                    ]
                }
            })
        });

        const paystackData = await paystackResponse.json();

        if (!paystackResponse.ok || !paystackData.status) {
            throw new Error(paystackData.message || 'Failed to initialize Paystack transaction');
        }

        return new Response(JSON.stringify({
            success: true,
            reference: paystackData.data.reference,
            access_code: paystackData.data.access_code
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
