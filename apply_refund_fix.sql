-- =============================================================
-- UPDATED process_order_refund RPC
-- Run this in Supabase SQL Editor to apply the fix.
--
-- Changes:
--   1. Accepts orders with status 'pending' OR 'paid' (was only 'pending')
--   2. Double-refund guard: checks wallet_transactions for existing refund
--   3. Row-level locking on order + wallet for safety
-- =============================================================

CREATE OR REPLACE FUNCTION process_order_refund(
  p_order_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_wallet_id uuid;
  v_refund_amount numeric;
BEGIN
  -- 1. Lock Order Row
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_order IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order not found');
  END IF;

  -- 2. Validate Refund Eligibility (accept pending or paid)
  IF v_order.payment_status NOT IN ('pending', 'paid') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order not eligible for refund (status: ' || v_order.payment_status || ')');
  END IF;

  -- 3. Double-refund guard: check if a refund transaction already exists
  IF EXISTS (
    SELECT 1 FROM public.wallet_transactions
    WHERE reference = p_order_id::text AND type = 'refund'
  ) THEN
    -- Already refunded — just update order status to be safe and return
    UPDATE public.orders
    SET payment_status = 'refunded', updated_at = now()
    WHERE id = p_order_id AND payment_status != 'refunded';

    RETURN jsonb_build_object('success', false, 'message', 'Already refunded');
  END IF;

  -- 4. Get Refund Amount from Metadata
  v_refund_amount := (v_order.metadata->>'wallet_deduction')::numeric;
  
  IF v_refund_amount IS NULL OR v_refund_amount <= 0 THEN
     RETURN jsonb_build_object('success', false, 'message', 'No valid refund amount found in metadata');
  END IF;

  -- 5. Get Wallet (with lock)
  SELECT id INTO v_wallet_id
  FROM public.wallets
  WHERE user_id = v_order.user_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
     RETURN jsonb_build_object('success', false, 'message', 'User wallet not found');
  END IF;

  -- 6. Refund Wallet
  UPDATE public.wallets
  SET balance = balance + v_refund_amount, updated_at = now()
  WHERE id = v_wallet_id;

  -- 7. Update Order Status
  UPDATE public.orders
  SET payment_status = 'refunded', updated_at = now()
  WHERE id = p_order_id;

  -- 8. Log Transaction
  INSERT INTO public.wallet_transactions (
    wallet_id,
    amount,
    type,
    reference,
    description
  ) VALUES (
    v_wallet_id,
    v_refund_amount,
    'refund',
    p_order_id::text,
    'Refund for expired/failed order ' || p_order_id
  );

  RETURN jsonb_build_object('success', true, 'message', 'Refund processed', 'amount', v_refund_amount);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;
