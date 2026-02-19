-- =============================================================
-- Fix Stuck Orders & Reconcile Wallet Balances
--
-- This script:
--   1. Diagnoses stuck orders (debit without verification)
--   2. Fixes stuck user 75121a89-1fba-4a47-a395-b00fae6a8d81
--   3. Creates reconcile_wallet_balance() function
--   4. All operations are idempotent
--
-- Run this in Supabase SQL Editor.
-- =============================================================


-- ═══════════════════════════════════════════════════════════════
-- PART 1: DIAGNOSTIC QUERIES
-- ═══════════════════════════════════════════════════════════════

-- 1a. Find ALL debits without matching verification rows (across all users)
SELECT
  wt.id AS tx_id,
  wt.user_id,
  wt.amount_kobo,
  wt.reference,
  wt.created_at AS tx_date,
  o.id AS order_id,
  o.service_type,
  o.payment_status,
  o.status AS order_status,
  v.id AS verification_id
FROM public.wallet_transactions wt
LEFT JOIN public.orders o ON o.payment_reference = wt.reference
LEFT JOIN public.verifications v ON v.order_id = o.id
WHERE wt.type = 'debit'
  AND wt.status = 'completed'
  AND v.id IS NULL
ORDER BY wt.created_at DESC;

-- 1b. Check wallet vs transaction sum mismatch (balance drift)
SELECT
  w.user_id,
  w.balance_kobo AS current_balance,
  COALESCE(SUM(wt.amount_kobo), 0) AS calculated_balance,
  w.balance_kobo - COALESCE(SUM(wt.amount_kobo), 0) AS drift
FROM public.wallets w
LEFT JOIN public.wallet_transactions wt ON wt.user_id = w.user_id AND wt.status = 'completed'
GROUP BY w.user_id, w.balance_kobo
HAVING w.balance_kobo != COALESCE(SUM(wt.amount_kobo), 0)
ORDER BY ABS(w.balance_kobo - COALESCE(SUM(wt.amount_kobo), 0)) DESC;

-- 1c. Check stuck user specifically
SELECT
  w.user_id,
  w.balance_kobo,
  w.currency,
  (SELECT COUNT(*) FROM public.wallet_transactions WHERE user_id = w.user_id) AS total_txs,
  (SELECT COUNT(*) FROM public.orders WHERE user_id = w.user_id) AS total_orders,
  (SELECT COUNT(*) FROM public.verifications WHERE user_id = w.user_id) AS total_verifications
FROM public.wallets w
WHERE w.user_id = '75121a89-1fba-4a47-a395-b00fae6a8d81';


-- ═══════════════════════════════════════════════════════════════
-- PART 2: FIX STUCK USER 75121a89-1fba-4a47-a395-b00fae6a8d81
-- ═══════════════════════════════════════════════════════════════

-- 2a. List all their debits without verification rows
SELECT
  wt.id AS tx_id,
  wt.amount_kobo,
  wt.reference,
  wt.created_at,
  o.id AS order_id,
  o.service_type,
  o.payment_status,
  o.status AS order_status,
  CASE WHEN v.id IS NULL THEN '❌ MISSING' ELSE '✅ EXISTS' END AS verification_status
FROM public.wallet_transactions wt
LEFT JOIN public.orders o ON o.payment_reference = wt.reference
LEFT JOIN public.verifications v ON v.order_id = o.id
WHERE wt.user_id = '75121a89-1fba-4a47-a395-b00fae6a8d81'
  AND wt.type = 'debit'
ORDER BY wt.created_at DESC;

-- 2b. Run the auto-refund function for this specific user
-- (This uses refund_failed_verification from refund_verification_debit.sql)
SELECT refund_failed_verification('75121a89-1fba-4a47-a395-b00fae6a8d81'::uuid) AS refund_result;


-- ═══════════════════════════════════════════════════════════════
-- PART 3: RECONCILE WALLET BALANCE FUNCTION
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION reconcile_wallet_balance(
  p_user_id uuid DEFAULT NULL  -- NULL = reconcile ALL wallets
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet RECORD;
  v_calculated bigint;
  v_fix_count int := 0;
  v_results jsonb[] := ARRAY[]::jsonb[];
BEGIN
  FOR v_wallet IN
    SELECT w.user_id, w.balance_kobo
    FROM public.wallets w
    WHERE (p_user_id IS NULL OR w.user_id = p_user_id)
    FOR UPDATE
  LOOP
    -- Calculate what balance SHOULD be from transaction history
    SELECT COALESCE(SUM(amount_kobo), 0) INTO v_calculated
    FROM public.wallet_transactions
    WHERE user_id = v_wallet.user_id
      AND status = 'completed';

    -- Fix drift if any
    IF v_wallet.balance_kobo != v_calculated THEN
      -- Log the adjustment as a transaction
      INSERT INTO public.wallet_transactions (
        user_id, amount_kobo, currency, type, reference, status
      ) VALUES (
        v_wallet.user_id,
        v_calculated - v_wallet.balance_kobo,
        'NGN',
        'adjustment',
        'RECONCILE-' || to_char(now(), 'YYYYMMDD-HH24MISS'),
        'completed'
      );

      -- Recalculate after adjustment tx
      SELECT COALESCE(SUM(amount_kobo), 0) INTO v_calculated
      FROM public.wallet_transactions
      WHERE user_id = v_wallet.user_id
        AND status = 'completed';

      -- Update wallet to match
      UPDATE public.wallets
      SET balance_kobo = v_calculated, updated_at = now()
      WHERE user_id = v_wallet.user_id;

      v_results := v_results || jsonb_build_object(
        'user_id', v_wallet.user_id,
        'old_balance', v_wallet.balance_kobo,
        'new_balance', v_calculated,
        'drift', v_wallet.balance_kobo - v_calculated
      );

      v_fix_count := v_fix_count + 1;

      RAISE NOTICE 'Reconciled user %: % → % (drift: %)',
        v_wallet.user_id, v_wallet.balance_kobo, v_calculated,
        v_wallet.balance_kobo - v_calculated;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'wallets_fixed', v_fix_count,
    'details', to_jsonb(v_results)
  );
END;
$$;

-- 3a. Run reconciliation for stuck user
SELECT reconcile_wallet_balance('75121a89-1fba-4a47-a395-b00fae6a8d81'::uuid) AS reconcile_result;

-- 3b. Verify final state
SELECT
  w.user_id,
  w.balance_kobo AS wallet_balance,
  COALESCE(SUM(wt.amount_kobo), 0) AS calculated_from_txs,
  CASE
    WHEN w.balance_kobo = COALESCE(SUM(wt.amount_kobo), 0) THEN '✅ MATCH'
    ELSE '❌ DRIFT'
  END AS status
FROM public.wallets w
LEFT JOIN public.wallet_transactions wt ON wt.user_id = w.user_id AND wt.status = 'completed'
WHERE w.user_id = '75121a89-1fba-4a47-a395-b00fae6a8d81'
GROUP BY w.user_id, w.balance_kobo;

-- Verify function exists
SELECT 'fix_stuck_orders_and_reconcile script completed' AS result;
