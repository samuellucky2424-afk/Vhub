import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
    console.log("Fetching last 3 orders...");
    const { data, error } = await supabase.from('orders').select('id, status, payment_status, price_kobo, request_id, created_at, metadata').order('created_at', { ascending: false }).limit(3);

    if (error) {
        console.error("Error fetching orders:", error);
        return;
    }

    console.log(JSON.stringify(data, null, 2));

    console.log("\nFetching last 3 wallet transactions...");
    const { data: txs, error: txsError } = await supabase.from('wallet_transactions').select('*').order('created_at', { ascending: false }).limit(3);

    if (txsError) {
        console.error("Error fetching wallet txs:", txsError);
        return;
    }

    console.log(JSON.stringify(txs, null, 2));
}

main().catch(console.error);
