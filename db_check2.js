import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE credentials in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Fetching last 3 orders...");
    const { data: orders, error: oErr } = await supabase
        .from('orders')
        .select('id, status, payment_status, metadata, price_kobo, created_at')
        .order('created_at', { ascending: false })
        .limit(3);

    if (oErr) console.error("Order err:", oErr);
    else console.log(JSON.stringify(orders, null, 2));

    console.log("\nFetching last 3 wallet transactions...");
    const { data: txs, error: tErr } = await supabase
        .from('wallet_transactions')
        .select('id, amount_kobo, type, status, reference, created_at')
        .order('created_at', { ascending: false })
        .limit(3);

    if (tErr) console.error("Tx err:", tErr);
    else console.log(JSON.stringify(txs, null, 2));
}

check();
