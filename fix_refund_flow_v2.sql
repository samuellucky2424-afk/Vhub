-- =============================================================
-- FIX: Refund Flow — Complete Fix Script
--
-- Run this ENTIRE script in Supabase SQL Editor.
--
-- WHAT THIS DOES:
--   1. Fixes the status constraint to include 'processing' (backward compat)
--   2. Re-deploys atomic_purchase_verification with status='pending'
--   3. Re-deploys process_order_refund (wallet credit on refund)
--   4. Re-deploys trigger_auto_refund trigger
--   5. Backfills stuck orders older than 3 minutes → 'refunded'
-- =============================================================


-- ─── Step 1: Fix status constraint ──────────────────────────────
-- Add 'processing' to the allowed list so old orders don't break,
-- but new orders will use 'pending' going forward.
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS order_status_check;
ALTER TABLE public.orders ADD CONSTRAINT order_status_check
  CHECK (status IN ('pending', 'processing', 'active', 'completed', 'refunded', 'expired'));


-- ─── Step 2: Re-deploy atomic_purchase_verification ─────────────
-- Changed: status = 'pending' (was 'processing')
CREATE OR REPLACE FUNCTION atomic_purchase_verification(
  p_user_id uuid,
  p_service_type text,
  p_country text,
  p_country_id text,
  p_service_id text,
  p_price_kobo bigint,
  p_exchange_rate numeric,
  p_phone_number text,
  p_smspool_order_id text,
  p_payment_reference text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance bigint;
  v_new_balance bigint;
  v_order_id uuid;
  v_verification_id uuid;
  v_existing_ref integer;
BEGIN
  -- 1. Idempotency check
  SELECT 1 INTO v_existing_ref
  FROM public.wallet_transactions
  WHERE reference = p_payment_reference
    AND type = 'debit'
    AND user_id = p_user_id;

  IF v_existing_ref IS NOT NULL THEN
    SELECT balance_kobo INTO v_current_balance
    FROM public.wallets WHERE user_id = p_user_id;

    SELECT id INTO v_order_id
    FROM public.orders
    WHERE payment_reference = p_payment_reference
    LIMIT 1;

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Already processed (idempotent)',
      'order_id', v_order_id,
      'new_balance', v_current_balance
    );
  END IF;

  -- 2. Lock wallet row
  SELECT w.balance_kobo INTO v_current_balance
  FROM public.wallets w
  WHERE w.user_id = p_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    INSERT INTO public.wallets (user_id, balance_kobo)
    VALUES (p_user_id, 0);
    v_current_balance := 0;
  END IF;

  -- 3. Check sufficient funds
  IF v_current_balance < p_price_kobo THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Insufficient funds',
      'balance', v_current_balance,
      'required', p_price_kobo
    );
  END IF;

  -- 4. Deduct balance
  v_new_balance := v_current_balance - p_price_kobo;
  UPDATE public.wallets
  SET balance_kobo = v_new_balance, updated_at = now()
  WHERE user_id = p_user_id;

  -- 5. Create order (status = 'pending' — matches constraint + frontend mapping)
  INSERT INTO public.orders (
    user_id, service_type, price_kobo, exchange_rate_ngn_per_usd, currency,
    payment_status, status, payment_reference, request_id, sms_code,
    metadata
  ) VALUES (
    p_user_id, p_service_type, p_price_kobo, p_exchange_rate, 'NGN',
    'paid', 'pending', p_payment_reference, p_smspool_order_id, null,
    p_metadata || jsonb_build_object(
      'wallet_deduction', p_price_kobo,
      'currency', 'NGN',
      'phonenumber', p_phone_number,
      'smspool_order_id', p_smspool_order_id,
      'source', 'wallet',
      'status', 'waiting_otp'
    )
  )
  RETURNING id INTO v_order_id;

  -- 6. Insert verification row
  INSERT INTO public.verifications (
    order_id, user_id, service_name,
    smspool_service_id, country_name, smspool_country_id,
    smspool_order_id, phone_number,
    otp_code, full_sms, received_at,
    final_price_charged, status
  ) VALUES (
    v_order_id, p_user_id, p_service_type,
    p_service_id, p_country, p_country_id,
    p_smspool_order_id, p_phone_number,
    'PENDING', 'Waiting for SMS...', now(),
    p_price_kobo, 'number_assigned'
  )
  RETURNING id INTO v_verification_id;

  -- 7. Log wallet transaction (debit)
  INSERT INTO public.wallet_transactions (
    user_id, amount_kobo, currency, type, reference, status
  ) VALUES (
    p_user_id, -p_price_kobo, 'NGN', 'debit', p_payment_reference, 'completed'
  );

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'verification_id', v_verification_id,
    'new_balance', v_new_balance,
    'amount_charged', p_price_kobo
  );
END;
$$;


-- ─── Step 3: Re-deploy process_order_refund ─────────────────────
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
  -- 1. Lock order row
  SELECT user_id, status, payment_status, price_kobo,
         (metadata->>'wallet_deduction')::bigint
  INTO v_user_id, v_order_status, v_payment_status, v_price_kobo, v_wallet_deduction
  FROM public.orders
  WHERE orders.id = p_order_id
  FOR UPDATE;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order not found');
  END IF;

  -- 2. Eligibility: status must be 'refunded', payment_status must NOT be 'refunded'
  IF v_order_status != 'refunded' THEN
    RETURN jsonb_build_object('success', false, 'message',
      'Order SMS status is not refunded (status: ' || COALESCE(v_order_status, 'null') || ')');
  END IF;

  IF v_payment_status = 'refunded' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Already refunded (payment_status)');
  END IF;

  -- 3. Lock wallet row
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

  -- 5. Determine refund amount
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

  -- 7. Credit wallet
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


-- ─── Step 4: Re-deploy auto-refund trigger ──────────────────────
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


-- ─── Step 5: Backfill stuck orders ──────────────────────────────
-- Any order with status='processing' or 'pending' AND older than 3 minutes
-- AND payment_status != 'refunded' → set status = 'refunded' (trigger fires)
UPDATE public.orders
SET status = 'refunded'
WHERE status IN ('processing', 'pending')
  AND payment_status IN ('paid', 'pending')
  AND payment_status != 'refunded'
  AND created_at < now() - interval '3 minutes';


-- ─── Step 6: Verify ─────────────────────────────────────────────
SELECT 'All functions and trigger deployed successfully' AS result;

SELECT tgname, tgrelid::regclass, tgenabled
FROM pg_trigger
WHERE tgname = 'trg_auto_refund';

SELECT proname
FROM pg_proc
WHERE proname IN ('process_order_refund', 'atomic_purchase_verification', 'trigger_auto_refund')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
