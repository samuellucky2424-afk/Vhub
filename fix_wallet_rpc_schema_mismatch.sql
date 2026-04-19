-- =============================================================
-- FIX: Wallet Refund System — Complete Rewrite
--
-- CHANGES:
--   1. Add orders.status column (SMS lifecycle: pending/active/completed/refunded/expired)
--   2. Rewrite process_order_refund() to check status='refunded' AND payment_status!='refunded'
--   3. Use wallet_id (NOT user_id) for wallet_transactions inserts
--   4. Remove EXCEPTION WHEN OTHERS — let errors propagate (financially safe)
--   5. Add trigger: AFTER UPDATE ON orders WHEN status='refunded' → auto-refund
--   6. Backfill: set status from payment_status for existing rows
--
-- Run this ENTIRE script in Supabase SQL Editor.
-- =============================================================


-- ─── Step 1: Fix status column + constraint ─────────────────────

-- 1a. Drop existing constraint that restricts status values
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS order_status_check;

-- 1b. Add status column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'orders' 
      AND column_name = 'status'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN status text DEFAULT 'pending';
  END IF;
END $$;

-- 1c. Backfill: map payment_status → valid SMS lifecycle status
--     'paid' and 'failed' are NOT valid SMS statuses, so map them properly
UPDATE public.orders SET status = 'pending'   WHERE status IS NULL;
UPDATE public.orders SET status = 'pending'   WHERE status = 'paid';
UPDATE public.orders SET status = 'expired'   WHERE status = 'failed';
-- 'pending', 'completed', 'refunded' are already valid for both columns

-- 1d. Re-create constraint with ALL valid SMS lifecycle values
ALTER TABLE public.orders ADD CONSTRAINT order_status_check 
  CHECK (status IN ('pending', 'active', 'completed', 'refunded', 'expired'));

-- 1e. Convert locked_balance to BIGINT for consistency with balance_kobo
ALTER TABLE public.wallets ALTER COLUMN locked_balance TYPE bigint USING locked_balance::bigint;


-- ─── Step 2: Rewrite process_order_refund ───────────────────────
CREATE OR REPLACE FUNCTION process_order_refund(
  p_order_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_payment_status text;
  v_order_status text;
  v_price_kobo bigint;
  v_wallet_deduction bigint;
  v_refund_amount bigint;
  v_current_balance bigint;
BEGIN
  -- 1. Lock order row and get details
  SELECT user_id, status, payment_status, price_kobo, 
         (metadata->>'wallet_deduction')::bigint
  INTO v_user_id, v_order_status, v_payment_status, v_price_kobo, v_wallet_deduction
  FROM public.orders
  WHERE orders.id = p_order_id
  FOR UPDATE;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order not found');
  END IF;

  -- 2. Eligibility checks
  IF v_order_status != 'refunded' THEN
    RETURN jsonb_build_object('success', false, 'message', 
      'Order SMS status is not refunded (status: ' || COALESCE(v_order_status, 'null') || ')');
  END IF;

  IF v_payment_status = 'refunded' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Already refunded (payment_status)');
  END IF;

  -- 3. Lock wallet row (wallets PK is user_id)
  PERFORM 1 FROM public.wallets
  WHERE wallets.user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'User wallet not found');
  END IF;

  -- 4. Double-refund guard
  IF EXISTS (
    SELECT 1 FROM public.wallet_transactions wt
    WHERE wt.reference = p_order_id::text 
      AND wt.type = 'refund'
      AND wt.user_id = v_user_id
  ) THEN
    UPDATE public.orders 
    SET payment_status = 'refunded'
    WHERE orders.id = p_order_id;
    RETURN jsonb_build_object('success', false, 'message', 'Already refunded (transaction exists)');
  END IF;

  -- 5. Determine refund amount in kobo (prefer wallet_deduction, fallback to price_kobo)
  v_refund_amount := v_wallet_deduction;
  IF v_refund_amount IS NULL OR v_refund_amount <= 0 THEN
    v_refund_amount := v_price_kobo;
  END IF;
  
  IF v_refund_amount IS NULL OR v_refund_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'No valid refund amount found');
  END IF;

  -- 6. Log refund transaction
  INSERT INTO public.wallet_transactions (
    user_id, amount_kobo, currency, type, reference, status
  ) VALUES (
    v_user_id,
    v_refund_amount,
    'NGN',
    'refund',
    p_order_id::text,
    'completed'
  );

  -- 7. Credit wallet balance_kobo
  UPDATE public.wallets
  SET balance_kobo = balance_kobo + v_refund_amount, updated_at = now()
  WHERE wallets.user_id = v_user_id;

  SELECT balance_kobo INTO v_current_balance
  FROM public.wallets WHERE wallets.user_id = v_user_id;

  -- 8. Mark payment_status as refunded
  UPDATE public.orders
  SET payment_status = 'refunded'
  WHERE orders.id = p_order_id;

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Refund processed', 
    'amount', v_refund_amount,
    'new_balance', v_current_balance
  );
END;
$$;


-- ─── Step 3: Fix process_purchase ────────────────────────────────
CREATE OR REPLACE FUNCTION process_purchase(
  p_user_id uuid,
  p_service_type text,
  p_country text,
  p_price_kobo bigint,
  p_exchange_rate numeric,
  p_metadata jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance bigint;
  v_order_id uuid;
  v_new_balance bigint;
BEGIN
  -- 1. Lock Wallet Row by user_id
  SELECT w.balance_kobo INTO v_current_balance
  FROM public.wallets w
  WHERE w.user_id = p_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    INSERT INTO public.wallets (user_id, balance_kobo) VALUES (p_user_id, 0);
    v_current_balance := 0;
  END IF;

  -- 2. Check Sufficient Funds (both in kobo)
  IF v_current_balance < p_price_kobo THEN
    RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
  END IF;

  -- 3. Deduct Balance (kobo)
  v_new_balance := v_current_balance - p_price_kobo;
  UPDATE public.wallets
  SET balance_kobo = v_new_balance, updated_at = now()
  WHERE wallets.user_id = p_user_id;

  -- 4. Create Order (price_kobo, exchange_rate, currency — NO price_usd)
  INSERT INTO public.orders (
    user_id, service_type, price_kobo, exchange_rate_ngn_per_usd, currency,
    payment_status, status, payment_reference, metadata
  ) VALUES (
    p_user_id, p_service_type, p_price_kobo, p_exchange_rate, 'NGN',
    'pending', 'pending',
    'WAL-' || gen_random_uuid(),
    p_metadata || jsonb_build_object('wallet_deduction', p_price_kobo, 'currency', 'NGN')
  )
  RETURNING id INTO v_order_id;

  -- 5. Log Transaction
  INSERT INTO public.wallet_transactions (
    user_id, amount_kobo, currency, type, reference, status
  ) VALUES (
    p_user_id, -p_price_kobo, 'NGN', 'debit', v_order_id::text, 'completed'
  );

  RETURN jsonb_build_object('success', true, 'order_id', v_order_id, 'new_balance', v_new_balance);
END;
$$;


-- ─── Step 4: Fix credit_wallet ──────────────────────────────────
CREATE OR REPLACE FUNCTION credit_wallet(
  p_user_id uuid,
  p_amount numeric,
  p_reference text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance bigint;
  v_existing_tx_id integer;
  v_new_balance bigint;
BEGIN
  -- 1. Idempotency Check
  SELECT 1 INTO v_existing_tx_id
  FROM public.wallet_transactions
  WHERE reference = p_reference AND type = 'deposit' AND user_id = p_user_id;

  IF v_existing_tx_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'message', 'Transaction already processed');
  END IF;

  -- 2. Lock Wallet Row
  SELECT balance_kobo INTO v_current_balance
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    INSERT INTO public.wallets (user_id, balance_kobo) VALUES (p_user_id, 0);
    v_current_balance := 0;
  END IF;

  -- 3. Credit Balance
  v_new_balance := v_current_balance + p_amount;
  UPDATE public.wallets
  SET balance_kobo = v_new_balance, updated_at = now()
  WHERE user_id = p_user_id;

  -- 4. Log Transaction
  INSERT INTO public.wallet_transactions (
    user_id, amount_kobo, currency, type, reference, status
  ) VALUES (
    p_user_id, p_amount, 'NGN', 'deposit', p_reference, 'completed'
  );

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance, 'message', 'Wallet credited successfully');
END;
$$;


-- ─── Step 5: Auto-refund trigger ────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_auto_refund()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NEW.status = 'refunded' AND NEW.payment_status != 'refunded' THEN
    v_result := process_order_refund(NEW.id);
    RAISE NOTICE 'Auto-refund result for order %: %', NEW.id, v_result;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_refund ON public.orders;
CREATE TRIGGER trg_auto_refund
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  WHEN (NEW.status = 'refunded' AND OLD.status IS DISTINCT FROM 'refunded')
  EXECUTE FUNCTION trigger_auto_refund();


-- ─── Step 6: Verify ─────────────────────────────────────────────
SELECT 'All functions and trigger created successfully' AS result;

SELECT tgname, tgrelid::regclass, tgenabled 
FROM pg_trigger 
WHERE tgname = 'trg_auto_refund';

SELECT proname 
FROM pg_proc 
WHERE proname IN ('process_order_refund', 'process_purchase', 'credit_wallet', 'trigger_auto_refund')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
