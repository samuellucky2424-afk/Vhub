
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://msbthxbmpwskializgaa.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zYnRoeGJtcHdza2lhbGl6Z2FhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDA1MjUzOCwiZXhwIjoyMDg1NjI4NTM4fQ.gWpP_3XZEPy1zw4a9iJWJEh0BKqbVPhOH4bP9uUUpLg';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkOrders() {
    console.log('Checking active orders...');
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .in('payment_status', ['paid'])
        .not('request_id', 'is', null);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Found ${data.length} active orders.`);
    data.forEach(o => {
        console.log(`ID: ${o.id}, RequestID: ${o.request_id}, Phone: ${o.metadata?.phonenumber || o.metadata?.number}, Code: ${o.sms_code || o.metadata?.sms_code}, SMSPoolStatus: ${o.metadata?.smspool_status}`);
        console.log(`Logs:`, JSON.stringify(o.metadata?.logs || []));
    });
}

checkOrders();
