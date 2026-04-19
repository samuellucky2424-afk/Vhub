/**
 * Debug: Check what metadata and amount fields exist on refunded orders
 */
const SUPABASE_URL = 'https://msbthxbmpwskializgaa.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zYnRoeGJtcHdza2lhbGl6Z2FhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDA1MjUzOCwiZXhwIjoyMDg1NjI4NTM4fQ.gWpP_3XZEPy1zw4a9iJWJEh0BKqbVPhOH4bP9uUUpLg';

async function main() {
    // 1. Check refunded orders' metadata
    console.log('=== Refunded Orders - Metadata Check ===');
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/orders?payment_status=eq.refunded&select=*`, {
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        }
    });

    const text = await resp.text();
    let orders;
    try {
        orders = JSON.parse(text);
    } catch (e) {
        console.log('Raw response:', text);
        return;
    }

    if (!Array.isArray(orders)) {
        console.log('Unexpected response:', JSON.stringify(orders, null, 2));
        return;
    }

    console.log(`Found ${orders.length} refunded orders\n`);

    for (const o of orders) {
        console.log(`Order: ${o.id}`);
        console.log(`  request_id: ${o.request_id}`);
        console.log(`  service_type: ${o.service_type}`);
        // Check ALL possible amount fields
        const cols = Object.keys(o);
        const amountCols = cols.filter(k => k.includes('amount') || k.includes('price') || k.includes('cost'));
        console.log(`  Amount-like columns: ${amountCols.map(k => `${k}=${o[k]}`).join(', ') || 'NONE'}`);
        console.log(`  metadata.wallet_deduction: ${o.metadata?.wallet_deduction ?? 'NOT SET'}`);
        console.log(`  metadata.price: ${o.metadata?.price ?? 'NOT SET'}`);
        console.log(`  metadata.cost_naira: ${o.metadata?.cost_naira ?? 'NOT SET'}`);
        console.log(`  metadata.amount: ${o.metadata?.amount ?? 'NOT SET'}`);
        console.log(`  All metadata keys: ${Object.keys(o.metadata || {}).join(', ')}`);
        console.log('');
    }

    // Show all columns on first order
    if (orders.length > 0) {
        console.log('=== All columns on first order ===');
        console.log(JSON.stringify(orders[0], null, 2));
    }

    // 2. Check wallet_transactions for refunds
    console.log('\n=== Wallet Transactions (refund type) ===');
    const txResp = await fetch(`${SUPABASE_URL}/rest/v1/wallet_transactions?type=eq.refund&select=*`, {
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        }
    });
    const txns = await txResp.json();
    if (Array.isArray(txns)) {
        console.log(`Found ${txns.length} refund transactions`);
        txns.forEach(t => {
            console.log(`  ${t.id} | amount: ${t.amount} | ref: ${t.reference} | ${t.description}`);
        });
    } else {
        console.log('Wallet txn response:', JSON.stringify(txns, null, 2));
    }
}

main().catch(console.error);
