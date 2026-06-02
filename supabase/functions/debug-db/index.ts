import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEBUG_DB_SECRET = Deno.env.get("DEBUG_DB_SECRET") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'authorization, x-debug-secret, content-type',
            }
        });
    }

    const authHeader = req.headers.get('Authorization') || '';
    const bearer = authHeader.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || '';
    const debugSecret = req.headers.get('x-debug-secret') || '';
    const isServiceRole = bearer === SUPABASE_SERVICE_ROLE_KEY;
    const isDebugSecret = !!DEBUG_DB_SECRET && debugSecret === DEBUG_DB_SECRET;

    if (!isServiceRole && !isDebugSecret) {
        return new Response(JSON.stringify({ success: false, message: 'Not found' }), {
            status: DEBUG_DB_SECRET ? 403 : 404,
            headers: { 'Content-Type': 'application/json' }
        });
    }

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
