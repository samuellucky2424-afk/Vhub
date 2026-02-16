const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://msbthxbmpwskializgaa.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zYnRoeGJtcHdza2lhbGl6Z2FhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDA1MjUzOCwiZXhwIjoyMDg1NjI4NTM4fQ.gWpP_3XZEPy1zw4a9iJWJEh0BKqbVPhOH4bP9uUUpLg';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function debugOrder() {
    const orderId = 'e51df094-4bc4-45a2-85a0-624cdfb07c29'; // From user JSON

    console.log(`Checking order ${orderId}...`);

    // 1. Check current state in DB
    const { data: order, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

    if (error) {
        console.error('Error fetching order:', error);
        return;
    }
    console.log('Current Order State:', {
        id: order.id,
        request_id: order.request_id,
        payment_status: order.payment_status,
        sms_code: order.sms_code,
        metadata_sms: order.metadata?.sms_code
    });

    const { data: verification } = await supabase
        .from('verifications')
        .select('*')
        .eq('order_id', orderId)
        .single();

    console.log('Current Verification State:', verification);

    // 2. Invoke check_order to force update
    console.log('\nInvoking smspool-service: check_order...');
    // We can't invoke function directly from node script easily without fetch, so we'll use fetch
    // But we need the ANON key or SERVICE role key.
    // Let's use fetch.

    const response = await fetch(`${SUPABASE_URL}/functions/v1/smspool-service`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({ action: 'check_sms' })
    });

    const result = await response.json();
    console.log('Function Result:', JSON.stringify(result, null, 2));

    // 3. Check DB again to see if it updated
    const { data: updatedVerification } = await supabase
        .from('verifications')
        .select('*')
        .eq('order_id', orderId)
        .single();

    console.log('Updated Verification State:', updatedVerification);
}

debugOrder();
