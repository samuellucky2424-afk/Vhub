const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPollSms() {
    console.log("Testing poll_sms action...");

    // 1. Create a dummy order or use existing one
    // for this test, let's look for a recent 'pending' order that has a request_id
    const { data: order, error } = await supabase
        .from('orders')
        .select('*')
        .not('request_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error || !order) {
        console.error("No suitable order found for testing:", error);
        return;
    }

    console.log(`Using Order ID: ${order.id} (Request ID: ${order.request_id})`);

    // 2. Invoke the function
    const { data: funcData, error: funcError } = await supabase.functions.invoke('smspool-service', {
        body: { action: 'poll_sms', order_id: order.id }
    });

    if (funcError) {
        console.error("Function Invocation Error:", funcError);
    } else {
        console.log("Function Response:", funcData);
    }
}

testPollSms();
