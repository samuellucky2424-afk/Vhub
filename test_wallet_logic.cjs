const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://msbthxbmpwskializgaa.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zYnRoeGJtcHdza2lhbGl6Z2FhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDA1MjUzOCwiZXhwIjoyMDg1NjI4NTM4fQ.gWpP_3XZEPy1zw4a9iJWJEh0BKqbVPhOH4bP9uUUpLg';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testWalletFlow() {
    console.log("=== Starting Wallet Flow Test ===");

    // 1. Get a test user
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();
    if (userError || !users.users.length) {
        console.error("Failed to list users or no users found:", userError);
        return;
    }
    const testUser = users.users[0];
    console.log(`Using Test User: ${testUser.id} (${testUser.email})`);

    // 2. Setup Wallet (Deposit 1000 NGN)
    console.log("\n--- Step 1: Deposit 1000 NGN ---");
    // We can directly insert/update wallet since we have service role
    // Check if wallet exists
    let { data: wallet } = await supabase.from('wallets').select('*').eq('user_id', testUser.id).single();

    if (!wallet) {
        console.log("Creating new wallet...");
        const { data: newWallet, error: createError } = await supabase.from('wallets').insert({
            user_id: testUser.id,
            balance: 1000,
            currency: 'NGN'
        }).select().single();
        if (createError) { console.error("Create Wallet Error:", createError); return; }
        wallet = newWallet;
    } else {
        console.log(`Existing Wallet Balance: ${wallet.balance}`);
        const { data: updatedWallet, error: updateError } = await supabase.from('wallets').update({ balance: 1000 }).eq('id', wallet.id).select().single();
        if (updateError) { console.error("Update Wallet Error:", updateError); return; }
        wallet = updatedWallet;
    }
    console.log(`Wallet Balance Set to: ${wallet.balance} NGN`);

    // 3. Test Purchase (Success)
    console.log("\n--- Step 2: Test Purchase (Cost 150 NGN) ---");
    const purchaseCost = 150;
    const { data: purchaseResult, error: purchaseError } = await supabase.rpc('process_purchase', {
        p_user_id: testUser.id,
        p_service_type: 'Test Service',
        p_country: 'Test Country',
        p_price_ngn: purchaseCost,
        p_price_usd: 0.1,
        p_metadata: { source: 'test_script' }
    });

    if (purchaseError) {
        console.error("Purchase RPC Error:", purchaseError);
        return;
    }
    console.log("Purchase Result:", purchaseResult);

    if (!purchaseResult.success) {
        console.error("Purchase Failed Unexpectedly");
        return;
    }

    // Verify Balance
    const { data: walletAfterPurchase } = await supabase.from('wallets').select('balance').eq('id', wallet.id).single();
    console.log(`New Balance: ${walletAfterPurchase.balance} (Expected: 850)`);
    if (walletAfterPurchase.balance !== 850) console.error("ASSERTION FAILED: Balance incorrect");

    // 4. Test Insufficient Funds
    console.log("\n--- Step 3: Test Insufficient Funds (Cost 10000 NGN) ---");
    const { data: failResult, error: failError } = await supabase.rpc('process_purchase', {
        p_user_id: testUser.id,
        p_service_type: 'Gold Service',
        p_country: 'Wakanda',
        p_price_ngn: 10000,
        p_price_usd: 10,
        p_metadata: { source: 'test_script' }
    });

    if (failError) console.error("RPC Error (Unexpected):", failError);
    console.log("Result:", failResult);
    if (failResult.success === false && failResult.message === 'Insufficient funds') {
        console.log("SUCCESS: Insufficient funds caught correctly.");
    } else {
        console.error("ASSERTION FAILED: Should have failed with insufficient funds");
    }

    // 5. Test Refund
    console.log("\n--- Step 4: Test Refund ---");
    const orderId = purchaseResult.order_id;
    console.log(`Refunding Order: ${orderId}`);

    const { data: refundResult, error: refundRpcError } = await supabase.rpc('process_order_refund', {
        p_order_id: orderId
    });

    if (refundRpcError) {
        console.error("Refund RPC Error:", refundRpcError);
        return;
    }
    console.log("Refund Result:", refundResult);

    // Verify Balance Restored
    const { data: walletAfterRefund } = await supabase.from('wallets').select('balance').eq('id', wallet.id).single();
    console.log(`Final Balance: ${walletAfterRefund.balance} (Expected: 1000)`);

    // Verify Order Status
    const { data: orderAfterRefund } = await supabase.from('orders').select('payment_status').eq('id', orderId).single();
    console.log(`Order Status: ${orderAfterRefund.payment_status} (Expected: refunded)`);

    if (walletAfterRefund.balance === 1000 && orderAfterRefund.payment_status === 'refunded') {
        console.log("\n=== TEST PASSED: Full Wallet Flow Verified ===");
    } else {
        console.log("\n=== TEST FAILED: Final state incorrect ===");
    }
}

testWalletFlow();
