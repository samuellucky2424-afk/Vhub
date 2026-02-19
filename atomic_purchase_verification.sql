-- =============================================================
-- atomic_purchase_verification — Single-transaction purchase
--
-- Does ALL of this atomically (auto-rollback on any failure):
--   1. Lock wallet row (FOR UPDATE)
--   2. Idempotency check on payment_reference
--   3. Check sufficient funds
--   4. Deduct balance_kobo
--   5. Insert wallet_transactions (debit)
--   6. Insert orders row
--   7. Insert verifications row
--
-- If ANY step fails → entire transaction rolls back.
-- No EXCEPTION WHEN OTHERS — errors propagate (financially safe).
--
-- Run this in Supabase SQL Editor.
-- =============================================================

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
  -- ─── 1. Idempotency: check if this reference was already processed ───
  SELECT 1 INTO v_existing_ref
  FROM public.wallet_transactions
  WHERE reference = p_payment_reference
    AND type = 'debit'
    AND user_id = p_user_id;

  IF v_existing_ref IS NOT NULL THEN
    -- Already processed — return success to avoid double deduction
    SELECT balance_kobo INTO v_current_balance
    FROM public.wallets WHERE user_id = p_user_id;

    -- Find the existing order
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

  -- ─── 2. Lock wallet row (prevents race conditions) ───
  SELECT w.balance_kobo INTO v_current_balance
  FROM public.wallets w
  WHERE w.user_id = p_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    -- Create wallet if not exists
    INSERT INTO public.wallets (user_id, balance_kobo)
    VALUES (p_user_id, 0);
    v_current_balance := 0;
  END IF;

  -- ─── 3. Check sufficient funds ───
  IF v_current_balance < p_price_kobo THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Insufficient funds',
      'balance', v_current_balance,
      'required', p_price_kobo
    );
  END IF;

  -- ─── 4. Deduct balance ───
  v_new_balance := v_current_balance - p_price_kobo;
  UPDATE public.wallets
  SET balance_kobo = v_new_balance, updated_at = now()
  WHERE user_id = p_user_id;

  -- ─── 5. Create order record ───
  INSERT INTO public.orders (
    user_id, service_type, price_kobo, exchange_rate_ngn_per_usd, currency,
    payment_status, status, payment_reference, request_id, sms_code,
    metadata
  ) VALUES (
    p_user_id, p_service_type, p_price_kobo, p_exchange_rate, 'NGN',
    'paid', 'active', p_payment_reference, p_smspool_order_id, null,
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

  -- ─── 6. Insert verification row ───
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

  -- ─── 7. Log wallet transaction (debit) ───
  INSERT INTO public.wallet_transactions (
    user_id, amount_kobo, currency, type, reference, status
  ) VALUES (
    p_user_id, -p_price_kobo, 'NGN', 'debit', p_payment_reference, 'completed'
  );

  -- ─── All succeeded — return result ───
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'verification_id', v_verification_id,
    'new_balance', v_new_balance,
    'amount_charged', p_price_kobo
  );
END;
$$;

-- Verify creation
SELECT 'atomic_purchase_verification function created successfully' AS result;
SELECT proname FROM pg_proc
WHERE proname = 'atomic_purchase_verification'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
