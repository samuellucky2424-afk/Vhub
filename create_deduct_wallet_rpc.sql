-- =============================================================
-- deduct_wallet RPC — Simple wallet deduction with row lock
-- 
-- This function ONLY deducts from the wallet and logs a transaction.
-- It does NOT create an order (unlike process_purchase).
-- Used by the new provider-first purchase flow.
--
-- Run this in Supabase SQL Editor.
-- =============================================================

CREATE OR REPLACE FUNCTION deduct_wallet(
  p_user_id uuid,
  p_amount_kobo bigint,
  p_reference text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance bigint;
  v_new_balance bigint;
  v_existing_tx_id integer;
BEGIN
  -- 1. Idempotency: check if this reference was already processed
  SELECT 1 INTO v_existing_tx_id
  FROM public.wallet_transactions
  WHERE reference = p_reference AND type = 'debit' AND user_id = p_user_id;

  IF v_existing_tx_id IS NOT NULL THEN
    -- Already processed — return success to avoid double deduction
    SELECT balance_kobo INTO v_current_balance
    FROM public.wallets WHERE user_id = p_user_id;
    RETURN jsonb_build_object('success', true, 'message', 'Already processed', 'new_balance', v_current_balance);
  END IF;

  -- 2. Lock wallet row (prevents race conditions / double deduction)
  SELECT w.balance_kobo INTO v_current_balance
  FROM public.wallets w
  WHERE w.user_id = p_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    -- Create wallet if not exists (unlikely at purchase time, but safe)
    INSERT INTO public.wallets (user_id, balance_kobo) VALUES (p_user_id, 0);
    v_current_balance := 0;
  END IF;

  -- 3. Check sufficient funds
  IF v_current_balance < p_amount_kobo THEN
    RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
  END IF;

  -- 4. Deduct balance
  v_new_balance := v_current_balance - p_amount_kobo;
  UPDATE public.wallets
  SET balance_kobo = v_new_balance, updated_at = now()
  WHERE wallets.user_id = p_user_id;

  -- 5. Log transaction
  INSERT INTO public.wallet_transactions (
    user_id, amount_kobo, currency, type, reference, status
  ) VALUES (
    p_user_id, -p_amount_kobo, 'NGN', 'debit', p_reference, 'completed'
  );

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

-- Verify
SELECT 'deduct_wallet function created successfully' AS result;
SELECT proname FROM pg_proc 
WHERE proname = 'deduct_wallet' 
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
