const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://msbthxbmpwskializgaa.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zYnRoeGJtcHdza2lhbGl6Z2FhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDA1MjUzOCwiZXhwIjoyMDg1NjI4NTM4fQ.gWpP_3XZEPy1zw4a9iJWJEh0BKqbVPhOH4bP9uUUpLg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function debugRefundFlow() {
    console.log('--- DEBUGGING REFUND FLOW ---');
    console.log(`Connected to: ${SUPABASE_URL}`);

    // 1. Check the 5 most recent orders
    console.log('\n--- 1. RECENT ORDERS ---');
    const { data: orders, error: ordersErr } = await supabase
        .from('orders')
        .select('id, user_id, status, payment_status, price_kobo, created_at, request_id, metadata, sms_code')
        .order('created_at', { ascending: false })
        .limit(5);

    if (ordersErr) {
        console.error('Error fetching orders:', ordersErr);
    } else if (orders) {
        orders.forEach((o, i) => {
            const elapsedMins = (Date.now() - new Date(o.created_at).getTime()) / (1000 * 60);
            console.log(`\nOrder [${i + 1}] ID: ${o.id}`);
            console.log(`  Created: ${new Date(o.created_at).toISOString()} (${elapsedMins.toFixed(1)} mins ago)`);
            console.log(`  Status DB: [${o.status}]  Payment Status DB: [${o.payment_status}]`);
            console.log(`  Request ID (SMSPool): ${o.request_id || 'none'}`);
            console.log(`  Timeout Cancelled: ${o.metadata?.timeout_cancelled ? 'YES' : 'NO'}`);
            console.log(`  SMSPool Status: ${o.metadata?.smspool_status || 'unknown'}`);
        });
    }

    // 2. Check recent wallet transactions
    console.log('\n--- 2. RECENT WALLET TRANSACTIONS ---');
    const { data: txs, error: txsErr } = await supabase
        .from('wallet_transactions')
        .select('id, user_id, amount_kobo, type, reference, status, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

    if (txsErr) {
        console.error('Error fetching transactions:', txsErr);
    } else if (txs) {
        txs.forEach((tx, i) => {
            console.log(`Tx [${i + 1}] ID: ${tx.id} | Type: ${tx.type.toUpperCase()} | Amount: ${tx.amount_kobo} kobo | Ref: ${tx.reference}`);
        });
    }
}

debugRefundFlow().catch(console.error);
