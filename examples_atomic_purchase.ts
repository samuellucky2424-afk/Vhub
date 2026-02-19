/**
 * ===================================================================
 * TypeScript/JavaScript Examples — Atomic Wallet Transactions
 *
 * These examples show how to use the new atomic RPCs from the
 * Supabase client. Run these in a Node.js/Deno environment with
 * the Supabase JS client configured.
 * ===================================================================
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!  // Use service role for admin operations
);


// ═══════════════════════════════════════════════════════════════
// EXAMPLE 1: Atomic Purchase + Verification (from edge function)
// ═══════════════════════════════════════════════════════════════

/**
 * Creates a verification order with wallet deduction in a single
 * atomic transaction. If any step fails, nothing is persisted.
 */
async function atomicPurchase(
    userId: string,
    serviceType: string,
    country: string,
    countryId: string,
    serviceId: string,
    priceKobo: number,
    exchangeRate: number,
    phoneNumber: string,
    smspoolOrderId: string
) {
    const paymentRef = `WAL-${crypto.randomUUID()}`;

    const { data, error } = await supabase.rpc('atomic_purchase_verification', {
        p_user_id: userId,
        p_service_type: serviceType,
        p_country: country,
        p_country_id: countryId,
        p_service_id: serviceId,
        p_price_kobo: priceKobo,
        p_exchange_rate: exchangeRate,
        p_phone_number: phoneNumber,
        p_smspool_order_id: smspoolOrderId,
        p_payment_reference: paymentRef,
        p_metadata: {
            source: 'wallet',
            raw_usd: priceKobo / exchangeRate / 100,
            rate: exchangeRate
        }
    });

    if (error) {
        console.error('RPC Error:', error.message);
        return { success: false, message: error.message };
    }

    if (!data.success) {
        console.error('Business Error:', data.message);
        return { success: false, message: data.message };
    }

    console.log('✅ Atomic purchase succeeded:', {
        orderId: data.order_id,
        verificationId: data.verification_id,
        newBalance: data.new_balance,
        charged: data.amount_charged
    });

    return data;
}


// ═══════════════════════════════════════════════════════════════
// EXAMPLE 2: Refund Stuck Orders (missing verification rows)
// ═══════════════════════════════════════════════════════════════

/**
 * Finds and refunds all debit transactions that don't have a
 * matching verification row. Pass a userId to fix one user,
 * or null to fix ALL users.
 *
 * Idempotent — safe to run multiple times.
 */
async function refundStuckOrders(userId: string | null = null) {
    const { data, error } = await supabase.rpc('refund_failed_verification', {
        p_user_id: userId
    });

    if (error) {
        console.error('Refund RPC Error:', error.message);
        return;
    }

    console.log(`✅ Refund complete:`, {
        refunded: data.refunded_count,
        skipped: data.skipped_already_refunded,
        details: data.details
    });

    return data;
}

// Fix specific user:
// await refundStuckOrders('75121a89-1fba-4a47-a395-b00fae6a8d81');

// Fix ALL users:
// await refundStuckOrders(null);


// ═══════════════════════════════════════════════════════════════
// EXAMPLE 3: Reconcile Wallet Balance
// ═══════════════════════════════════════════════════════════════

/**
 * Recalculates wallet balance from transaction history.
 * If there's a drift (balance != SUM(transactions)), it:
 *   1. Logs an adjustment transaction
 *   2. Corrects the wallet balance
 *
 * Idempotent — safe to run multiple times.
 */
async function reconcileBalance(userId: string | null = null) {
    const { data, error } = await supabase.rpc('reconcile_wallet_balance', {
        p_user_id: userId
    });

    if (error) {
        console.error('Reconcile RPC Error:', error.message);
        return;
    }

    if (data.wallets_fixed === 0) {
        console.log('✅ All wallets are in sync — no drift detected.');
    } else {
        console.log(`⚠️ Fixed ${data.wallets_fixed} wallet(s):`, data.details);
    }

    return data;
}

// Reconcile specific user:
// await reconcileBalance('75121a89-1fba-4a47-a395-b00fae6a8d81');

// Reconcile ALL wallets:
// await reconcileBalance(null);


// ═══════════════════════════════════════════════════════════════
// EXAMPLE 4: Check for Failures (monitoring)
// ═══════════════════════════════════════════════════════════════

/**
 * Query the failure_logs table to see recent issues.
 */
async function checkFailures(limit = 20) {
    const { data, error } = await supabase
        .from('failure_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Failed to fetch failure logs:', error.message);
        return;
    }

    if (data.length === 0) {
        console.log('✅ No failures logged.');
    } else {
        console.log(`⚠️ ${data.length} failure(s) found:`);
        data.forEach((log: any) => {
            console.log(`  [${log.created_at}] ${log.action}: ${log.error_message}`);
            if (log.context) console.log(`    Context:`, log.context);
        });
    }

    return data;
}


// ═══════════════════════════════════════════════════════════════
// EXAMPLE 5: Full Fix for Stuck User (run all steps)
// ═══════════════════════════════════════════════════════════════

/**
 * Complete fix workflow for a stuck user:
 * 1. Refund any stuck orders (debit without verification)
 * 2. Reconcile wallet balance
 * 3. Verify final state
 */
async function fullFixForUser(userId: string) {
    console.log(`\n🔧 Starting full fix for user: ${userId}\n`);

    // Step 1: Check current state
    const { data: wallet } = await supabase
        .from('wallets')
        .select('balance_kobo, currency')
        .eq('user_id', userId)
        .single();

    console.log(`Current balance: ${wallet?.balance_kobo} kobo (₦${(wallet?.balance_kobo || 0) / 100})`);

    // Step 2: Refund stuck orders
    console.log('\n📦 Step 1: Refunding stuck orders...');
    const refundResult = await refundStuckOrders(userId);
    console.log(`   Refunded: ${refundResult?.refunded_count || 0}`);

    // Step 3: Reconcile balance
    console.log('\n🔄 Step 2: Reconciling wallet balance...');
    const reconcileResult = await reconcileBalance(userId);
    console.log(`   Fixed: ${reconcileResult?.wallets_fixed || 0}`);

    // Step 4: Verify
    const { data: walletAfter } = await supabase
        .from('wallets')
        .select('balance_kobo')
        .eq('user_id', userId)
        .single();

    const { data: txSum } = await supabase
        .rpc('reconcile_wallet_balance', { p_user_id: userId });

    console.log(`\n✅ Final balance: ${walletAfter?.balance_kobo} kobo (₦${(walletAfter?.balance_kobo || 0) / 100})`);
    console.log(`🔧 Full fix complete for user: ${userId}\n`);
}

// Run the full fix for the stuck user:
// fullFixForUser('75121a89-1fba-4a47-a395-b00fae6a8d81');
