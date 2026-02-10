const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://msbthxbmpwskializgaa.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zYnRoeGJtcHdza2lhbGl6Z2FhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDA1MjUzOCwiZXhwIjoyMDg1NjI4NTM4fQ.gWpP_3XZEPy1zw4a9iJWJEh0BKqbVPhOH4bP9uUUpLg';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function createTestOrder() {
    console.log('Creating test order with SMS...');

    // Get a valid user ID
    const { data: existingOrder } = await supabase.from('orders').select('user_id').limit(1).single();
    if (!existingOrder) {
        console.error('No existing orders found to get user ID from.');
        return;
    }

    const testOrder = {
        user_id: existingOrder.user_id,
        payment_status: 'paid',
        payment_reference: 'TEST_REF_' + Date.now(), // Fixed: Add required payment_reference
        service_type: 'Test Service',
        price_usd: 0.10,
        request_id: 'TEST_SMS_' + Date.now(),
        metadata: {
            phonenumber: '1234567890',
            country: 'US',
            serviceId: 'test',
            countryId: '1',
            smspool_status: 3, // Completed
            sms_code: '123456',
            logs: [
                {
                    id: 'test-log-1',
                    sender: 'Test Service',
                    message: 'Your verification code is 123456',
                    code: '123456',
                    receivedAt: new Date().toISOString(),
                    isRead: false
                }
            ]
        }
    };

    const { data, error } = await supabase.from('orders').insert(testOrder).select();

    if (error) {
        console.error('Error creating test order:', error);
    } else {
        console.log('Test order created successfully:', data);
        console.log('Please check the dashboard to see if "Test Service" appears with code.');
    }
}

createTestOrder();
