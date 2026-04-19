/**
 * Debug script: Force-sync all pending orders from SMSPool
 * This calls the deployed sync_order_status for each pending order
 */
const SUPABASE_URL = 'https://msbthxbmpwskializgaa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zYnRoeGJtcHdza2lhbGl6Z2FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNTI1MzgsImV4cCI6MjA4NTYyODUzOH0.T3mZaWb4LBwXjOSu6kSCly9kiE2ob8q8y6KgD3AFdQM';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zYnRoeGJtcHdza2lhbGl6Z2FhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDA1MjUzOCwiZXhwIjoyMDg1NjI4NTM4fQ.gWpP_3XZEPy1zw4a9iJWJEh0BKqbVPhOH4bP9uUUpLg';

async function main() {
    // Step 1: Fetch all pending orders from Supabase directly
    console.log('=== Step 1: Fetching pending orders from Supabase ===');
    const ordersResp = await fetch(`${SUPABASE_URL}/rest/v1/orders?payment_status=eq.pending&select=id,request_id,payment_status,service_type,created_at`, {
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        }
    });
    const orders = await ordersResp.json();
    console.log(`Found ${orders.length} pending orders:`);
    orders.forEach(o => {
        console.log(`  - ID: ${o.id} | request_id: ${o.request_id || 'NONE'} | service: ${o.service_type} | created: ${o.created_at}`);
    });

    if (orders.length === 0) {
        console.log('\nNo pending orders found. Nothing to sync.');
        return;
    }

    // Step 2: For each pending order with a request_id, call sync_order_status
    console.log('\n=== Step 2: Syncing each pending order via edge function ===');
    for (const order of orders) {
        if (!order.request_id) {
            console.log(`\n[SKIP] Order ${order.id} has no request_id (SMSPool order never placed)`);
            continue;
        }

        console.log(`\n[SYNC] Order ${order.id} (SMSPool: ${order.request_id})...`);
        try {
            const syncResp = await fetch(`${SUPABASE_URL}/functions/v1/smspool-service`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({ action: 'sync_order_status', order_id: order.id })
            });
            const result = await syncResp.json();
            console.log(`  Result:`, JSON.stringify(result, null, 2));
        } catch (err) {
            console.error(`  ERROR:`, err.message);
        }
    }

    // Step 3: Re-fetch orders to confirm status changed
    console.log('\n=== Step 3: Verifying updated statuses ===');
    const verifyResp = await fetch(`${SUPABASE_URL}/rest/v1/orders?select=id,request_id,payment_status,service_type&order=created_at.desc&limit=20`, {
        headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        }
    });
    const updated = await verifyResp.json();
    console.log('Latest 20 orders after sync:');
    updated.forEach(o => {
        const icon = o.payment_status === 'pending' ? '⏳' : o.payment_status === 'refunded' ? '💰' : o.payment_status === 'completed' ? '✅' : '❓';
        console.log(`  ${icon} ${o.id} | status: ${o.payment_status} | request_id: ${o.request_id || 'none'} | ${o.service_type}`);
    });
}

main().catch(console.error);
