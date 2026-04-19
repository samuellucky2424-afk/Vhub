import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
    const { data: orders } = await supabase
        .from('orders')
        .select('id, status, payment_status, metadata, price_kobo, created_at')
        .order('created_at', { ascending: false })
        .limit(3);

    const { data: txs } = await supabase
        .from('wallet_transactions')
        .select('id, amount_kobo, type, status, reference, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

    return new Response(JSON.stringify({ orders, txs }, null, 2), {
        headers: { 'Content-Type': 'application/json' }
    });
});
