const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://msbthxbmpwskializgaa.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zYnRoeGJtcHdza2lhbGl6Z2FhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDA1MjUzOCwiZXhwIjoyMDg1NjI4NTM4fQ.gWpP_3XZEPy1zw4a9iJWJEh0BKqbVPhOH4bP9uUUpLg';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testVerificationInsert() {
    console.log('Testing Verification Insert...');

    // 1. Get a valid user to create an order for
    const { data: user } = await supabase.from('orders').select('user_id').limit(1).single();
    if (!user) {
        console.error("No users found to attach order to.");
        return;
    }

    // 2. Create a dummy order
    const orderPayload = {
        user_id: user.user_id,
        payment_status: 'paid',
        service_type: 'Debug Service',
        price_usd: 0.1,
        payment_reference: 'DEBUG-' + Date.now(),
        metadata: { debug: true }
    };

    const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert(orderPayload)
        .select()
        .single();

    if (orderError) {
        console.error("Failed to create dummy order:", orderError);
        return;
    }
    console.log("Dummy Order Created:", order.id);

    // 3. Attempt Insert into Verifications (Mimic smspool-service)
    const verificationPayload = {
        order_id: order.id,
        user_id: user.user_id,
        service_name: 'Debug Service',
        smspool_service_id: '123',
        country_name: 'United States',
        smspool_country_id: '1',
        // phonenumber: '1234567890', 
        otp_code: "PENDING",
        full_sms: "Waiting for SMS...",
        received_at: new Date().toISOString()
    };

    const { data: vData, error: vError } = await supabase
        .from("verifications")
        .insert(verificationPayload)
        .select();

    if (vError) {
        console.error("❌ Verification INSERT Failed:", vError);
    } else {
        console.log("✅ Verification INSERT Success:", vData);

        // 4. Attempt Update
        const { error: uError } = await supabase
            .from("verifications")
            .update({ otp_code: "123456", full_sms: "Code is 123456" })
            .eq('order_id', order.id);

        if (uError) console.error("❌ Verification UPDATE Failed:", uError);
        else console.log("✅ Verification UPDATE Success");
    }

    // Cleanup
    // await supabase.from('orders').delete().eq('id', order.id); // might fail due to FK?
}

testVerificationInsert();
