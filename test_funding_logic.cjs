const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://msbthxbmpwskializgaa.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zYnRoeGJtcHdza2lhbGl6Z2FhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDA1MjUzOCwiZXhwIjoyMDg1NjI4NTM4fQ.gWpP_3XZEPy1zw4a9iJWJEh0BKqbVPhOH4bP9uUUpLg';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testFundingLogic() {
    console.log("=== Testing Wallet Funding Logic ===");

    // 1. Get Test User
    const { data: users } = await supabase.auth.admin.listUsers();
    if (!users.users.length) { console.error("No users found"); return; }
    const testUser = users.users[0];
    console.log(`User: ${testUser.id}`);

    // 2. Get Initial Balance
    let { data: wallet } = await supabase.from('wallets').select('balance').eq('user_id', testUser.id).single();
    if (!wallet) {
        // Create if missing
        await supabase.from('wallets').insert({ user_id: testUser.id, balance: 0 });
        wallet = { balance: 0 };
    }
    const initialBalance = wallet.balance;
    console.log(`Initial Balance: ${initialBalance}`);

    // 3. Test Credit Wallet RPC
    const creditAmount = 5000;
    const reference = `test_fund_${Date.now()}`;

    console.log(`\nAttempting to credit ${creditAmount} NGN with ref ${reference}...`);

    const { data: creditResult, error: creditError } = await supabase.rpc('credit_wallet', {
        p_user_id: testUser.id,
        p_amount: creditAmount,
        p_reference: reference,
        p_metadata: { source: 'test_script' }
    });

    if (creditError) {
        // If RPC missing, this will fail
        if (creditError.message.includes('function credit_wallet') && creditError.message.includes('does not exist')) {
            console.error("❌ RPC 'credit_wallet' NOT FOUND. Please run 'create_credit_wallet_rpc.sql'.");
        } else {
            console.error("❌ Credit Error:", creditError);
        }
        return;
    }

    console.log("RPC Result:", creditResult);

    // 4. Verify Balance Update
    const { data: newWallet } = await supabase.from('wallets').select('balance').eq('user_id', testUser.id).single();
    console.log(`New Balance: ${newWallet.balance}`);

    if (newWallet.balance === initialBalance + creditAmount) {
        console.log("✅ Balance updated correctly.");
    } else {
        console.error("❌ Balance update mismatch!");
    }

    // 5. Test Idempotency (Duplicate Reference)
    console.log(`\nAttempting duplicate credit with same ref ${reference}...`);
    const { data: dupResult, error: dupError } = await supabase.rpc('credit_wallet', {
        p_user_id: testUser.id,
        p_amount: creditAmount,
        p_reference: reference,
        p_metadata: { source: 'test_script_retry' }
    });

    if (dupResult && dupResult.message === 'Transaction already processed') {
        console.log("✅ Idempotency check PASSED (Transaction already processed).");
    } else {
        console.error("❌ Idempotency check FAILED or Unexpected Result:", dupResult);
    }

    // 6. Verify Transaction Log
    const { data: logs } = await supabase.from('wallet_transactions').select('*').eq('reference', reference);
    console.log(`\nTransaction Logs found: ${logs.length}`);
    if (logs.length === 1 && logs[0].amount === creditAmount && logs[0].type === 'deposit') {
        console.log("✅ Transaction log verified.");
    } else {
        console.error("❌ Transaction log verification failed.");
    }

    console.log("\n=== Test Complete ===");
}

testFundingLogic();
