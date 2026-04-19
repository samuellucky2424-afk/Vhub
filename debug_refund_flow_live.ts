import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

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

    // 3. Test edge function directly for the most recent pending order
    const pendingOrder = orders?.find(o => o.status === 'pending' || o.status === 'processing' || o.payment_status === 'pending');
    if (pendingOrder) {
        console.log(`\n--- 3. TESTING SYNC EDGE FUNCTION for Order ${pendingOrder.id} ---`);
        try {
            const response = await fetch(`${SUPABASE_URL}/functions/v1/smspool-service`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                },
                body: JSON.stringify({ action: 'sync_order_status', order_id: pendingOrder.id })
            });
            const text = await response.text();
            console.log(`Edge Function response (${response.status}):\n`, text);
        } catch (err: any) {
            console.error('Error calling edge function:', err.message);
        }
    } else {
        console.log('\nNo pending orders found to test the edge function against.');
    }
}

debugRefundFlow().catch(console.error);
