const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://msbthxbmpwskializgaa.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zYnRoeGJtcHdza2lhbGl6Z2FhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDA1MjUzOCwiZXhwIjoyMDg1NjI4NTM4fQ.gWpP_3XZEPy1zw4a9iJWJEh0BKqbVPhOH4bP9uUUpLg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testRPC() {
    const orderId = 'e38349cf-f048-4349-ad00-8f30a150bc29';
    console.log(`Executing process_order_refund for ${orderId}...`);
    const { data, error } = await supabase.rpc('process_order_refund', { p_order_id: orderId });
    console.log('Result:', data);
    if (error) console.error('Error:', error);
}

testRPC().catch(console.error);
