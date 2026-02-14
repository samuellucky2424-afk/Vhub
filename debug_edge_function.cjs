const { createClient } = require('@supabase/supabase-js');


const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://msbthxbmpwskializgaa.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zYnRoeGJtcHdza2lhbGl6Z2FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNTI1MzgsImV4cCI6MjA4NTYyODUzOH0.T3mZaWb4LBwXjOSu6kSCly9kiE2ob8q8y6KgD3AFdQM';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
    console.log("Invoking smspool-service: check_sms");
    const { data, error } = await supabase.functions.invoke('smspool-service', {
        body: { action: 'check_sms' }
    });

    if (error) {
        console.error("Error invoking function:", error);
    } else {
        console.log("Function Response:", JSON.stringify(data, null, 2));
        if (data.debug) {
            console.log("\n--- Debug Logs ---");
            data.debug.forEach(log => console.log(log));
        }
    }
}

run();
