const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://msbthxbmpwskializgaa.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zYnRoeGJtcHdza2lhbGl6Z2FhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDA1MjUzOCwiZXhwIjoyMDg1NjI4NTM4fQ.gWpP_3XZEPy1zw4a9iJWJEh0BKqbVPhOH4bP9uUUpLg';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function verifySetup() {
    console.log("Verifying Database Setup...");

    let missing = [];

    // 1. Check Wallets Table
    const { error: tableError } = await supabase.from('wallets').select('id').limit(1);
    if (tableError) {
        if (tableError.message.includes('relation "public.wallets" does not exist') || tableError.code === '42P01') {
            missing.push("- Table: 'wallets' is MISSING.");
        } else {
            console.log(`Table check error: ${tableError.message} (might be permission or other issue)`);
        }
    } else {
        console.log("✅ Table 'wallets' found.");
    }

    // 2. Check RPC process_purchase
    // We try to call it with null args, just to see if it exists (it should error with parameter validation, not 'function not found')
    const { error: rpcError } = await supabase.rpc('process_purchase', {});

    if (rpcError) {
        if (rpcError.message.includes('function process_purchase') && rpcError.message.includes('does not exist')) {
            missing.push("- RPC Function: 'process_purchase' is MISSING.");
        }
        else if (rpcError.code === '42883') { // Undefined function
            missing.push("- RPC Function: 'process_purchase' is MISSING.");
        }
        else {
            // It exists but failed due to args, which is good
            console.log("✅ RPC 'process_purchase' found.");
        }
    } else {
        console.log("✅ RPC 'process_purchase' found.");
    }

    if (missing.length > 0) {
        console.error("\n❌ Database Schema Incomplete:");
        missing.forEach(m => console.log(m));
        console.log("\nPlease run the following SQL files in your Supabase Dashboard SQL Editor:");
        console.log("1. create_wallet_tables.sql");
        console.log("2. create_wallet_functions.sql");
    } else {
        console.log("\n✅ Database Setup Complete. You can verify the flow.");
    }
}

verifySetup();
