const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://msbthxbmpwskializgaa.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zYnRoeGJtcHdza2lhbGl6Z2FhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDA1MjUzOCwiZXhwIjoyMDg1NjI4NTM4fQ.gWpP_3XZEPy1zw4a9iJWJEh0BKqbVPhOH4bP9uUUpLg';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function createTestOrder() {
    console.log('Creating test order with SMS...');

    // Create a fake order that looks like a completed SMSPool order
    const testOrder = {
        user_id: 'e1d8c1c2-3f4a-4b5c-6d7e-8f9a0b1c2d3e', // Need a valid user ID. 
        // I'll try to fetch the first user from auth.users or just use the one from existing orders.
        // Let's get a user ID from an existing order first.
        payment_status: 'paid',
        service_type: 'Test Service',
        price_usd: 0.10,
        request_id: 'TEST_SMS_123',
        sms_code: '123456',
        metadata: {
            phonenumber: '1234567890',
            country: 'US',
            serviceId: 'test',
            countryId: '1',
            smspool_status: 3, // Completed
            logs: [
                {
                    id: 'test-log-1',
                    sender: 'Test Service',
                    message: 'Your code is 123456',
                    code: '123456',
                    receivedAt: new Date().toISOString()
                }
            ]
        }
    };

    // Get a valid user ID
    const { data: existingOrder } = await supabase.from('orders').select('user_id').limit(1).single();
    if (existingOrder) {
        testOrder.user_id = existingOrder.user_id;
    } else {
        console.error('No existing orders found to get user ID from.');
        return;
    }

    const { data, error } = await supabase.from('orders').insert(testOrder).select();

    if (error) {
        console.error('Error creating test order:', error);
    } else {
        console.log('Test order created successfully:', data);
        console.log('Please check the dashboard to see if "Test Service" appears with code "123456".');
    }
}

createTestOrder();
