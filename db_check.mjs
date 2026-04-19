import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://msbthxbmpwskializgaa.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseKey) {
    console.error("Missing SUPABASE_ANON_KEY in env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: orders, error: oErr } = await supabase
        .from('orders')
        .select('id, status, payment_status, metadata, price_kobo, created_at')
        .order('created_at', { ascending: false })
        .limit(3);

    if (oErr) console.error("Order err:", oErr);
    else console.log("Orders:\n" + JSON.stringify(orders, null, 2));

    const { data: txs, error: tErr } = await supabase
        .from('wallet_transactions')
        .select('id, amount_kobo, type, status, created_at')
        .order('created_at', { ascending: false })
        .limit(3);

    if (tErr) console.error("Tx err:", tErr);
    else console.log("\nTransactions:\n" + JSON.stringify(txs, null, 2));
}

check();
