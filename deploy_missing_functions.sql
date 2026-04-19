-- =============================================================
-- DEPLOY MISSING DATABASE FUNCTIONS
-- Run this entire file in Supabase Dashboard → SQL Editor
-- This fixes the "Wallet service error" 500 from smspool-service
-- =============================================================

-- ──────────────────────────────────────────────
-- 1. failure_logs table + log_failure() function
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.failure_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  error_message text,
  context jsonb DEFAULT '{}'::jsonb,
  resolved boolean DEFAULT false,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.failure_logs ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.failure_logs TO service_role;

CREATE OR REPLACE FUNCTION log_failure(
  p_user_id uuid,
  p_action text,
  p_error_message text,
  p_context jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO public.failure_logs (user_id, action, error_message, context)
  VALUES (p_user_id, p_action, p_error_message, p_context)
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- ──────────────────────────────────────────────
-- 2. get_wallet_balance() — reads wallet safely
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_wallet_balance(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet RECORD;
BEGIN
  SELECT * INTO v_wallet
  FROM public.wallets
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.wallets (user_id, balance_kobo, currency)
    VALUES (p_user_id, 0, 'NGN')
    ON CONFLICT (user_id) DO NOTHING;

    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE user_id = p_user_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'found', false,
        'balance_kobo', 0,
        'balance', 0,
        'message', 'Could not create wallet'
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'balance_kobo', COALESCE(v_wallet.balance_kobo, 0),
    'balance', COALESCE(v_wallet.balance_kobo, 0),
    'currency', COALESCE(v_wallet.currency, 'NGN'),
    'user_id', v_wallet.user_id
  );
END;
$$;

-- ──────────────────────────────────────────────
-- 3. atomic_purchase_verification() — full purchase
-- ──────────────────────────────────────────────
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

  -- 5. Create order record
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

  -- All succeeded
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'verification_id', v_verification_id,
    'new_balance', v_new_balance,
    'amount_charged', p_price_kobo
  );
END;
$$;

-- ──────────────────────────────────────────────
-- VERIFICATION
-- ──────────────────────────────────────────────
SELECT 'All 3 functions deployed successfully' AS result;

SELECT proname FROM pg_proc
WHERE proname IN ('get_wallet_balance', 'atomic_purchase_verification', 'log_failure')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
