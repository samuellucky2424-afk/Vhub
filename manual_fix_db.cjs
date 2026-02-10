const { createClient } = require('@supabase/supabase-js');

// Hardcoded keys from .env
const SUPABASE_URL = 'https://msbthxbmpwskializgaa.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zYnRoeGJtcHdza2lhbGl6Z2FhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDA1MjUzOCwiZXhwIjoyMDg1NjI4NTM4fQ.gWpP_3XZEPy1zw4a9iJWJEh0BKqbVPhOH4bP9uUUpLg';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function fixOrder() {
    console.log('Starting manual fix...');

    const targetRequestId = 'TNCNWYTA';

    // Fetch order
    const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('request_id', targetRequestId);

    if (error) {
        console.error('Error fetching:', error);
        return;
    }

    if (orders.length === 0) {
        console.log(`Order ${targetRequestId} not found.`);
        return;
    }

    const order = orders[0];
    console.log(`Found order ${order.id} (RequestID: ${order.request_id}) with payment_status: ${order.payment_status}`);

    // Update metadata regardless of status to ensure UI reflects it if payment_status is 'paid'
    // But we only want to do this if it's currently 'paid' or if we want to force it.
    // The user said "it's already refunded".

    if (order.payment_status === 'paid') {
        console.log('Order is paid/active. Updating metadata...');

        const updates = {
            metadata: {
                ...order.metadata,
                smspool_status: 2, // Refunded
                manual_fix: true,
                fixed_at: new Date().toISOString()
            }
        };

        const { error: updateError } = await supabase
            .from('orders')
            .update(updates)
            .eq('id', order.id);

        if (updateError) {
            console.error('Update failed:', updateError);
        } else {
            console.log(`Successfully updated order ${order.request_id} metadata to include refund status.`);
        }
    } else {
        console.log('Order is not in "paid" status, skipping update.');
    }
}

fixOrder();
