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

    // Create a fake order that looks like a completed SMSPool order
    // 'sms_code' column might not exist if I saw the error correctly. 
    // Let me check if 'sms_code' exists in schema. The error said "Could not find the 'sms_code' column".
    // I recall reading code earlier where it updated 'sms_code'.
    // Maybe I should check the schema or just use metadata.
    // The previous code in index.ts TRIED to update sms_code. If that column doesn't exist, index.ts would fail too?
    // Wait, the earlier logs showed "Updated active order ... with new code". 
    // Maybe I misread the error? Or the column was added recently? 
    // Actually, looking at index.ts: await supabase.from('orders').update({ metadata: updatedMetadata, sms_code: code })
    // If that works, the column exists.
    // The error "Could not find the 'sms_code' column of 'orders' in the schema cache" implies it might be a supabase client caching issue or I misremembered.
    // Let's try WITHOUT sms_code column first, putting it in metadata only.

    const testOrder = {
        user_id: existingOrder.user_id,
        payment_status: 'paid',
        service_type: 'Test Service',
        price_usd: 0.10,
        request_id: 'TEST_SMS_' + Date.now(),
        // sms_code: '123456', // Removing this for now to see if it inserts
        metadata: {
            phonenumber: '1234567890',
            country: 'US',
            serviceId: 'test',
            countryId: '1',
            smspool_status: 3, // Completed
            sms_code: '123456', // Put here for UI to find if it looks here? App.tsx looks at logs.
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
        console.log('Please check the dashboard to see if "Test Service" appears.');
    }
}

createTestOrder();
