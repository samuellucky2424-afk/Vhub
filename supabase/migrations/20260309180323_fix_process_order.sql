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
  SELECT user_id, status, payment_status, price_kobo,
         (metadata->>'wallet_deduction')::bigint
  INTO v_user_id, v_order_status, v_payment_status, v_price_kobo, v_wallet_deduction
  FROM public.orders
  WHERE orders.id = p_order_id
  FOR UPDATE;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order not found');
  END IF;

  IF v_order_status != 'refunded' THEN
    RETURN jsonb_build_object('success', false, 'message',
      'Order SMS status is not refunded (status: ' || COALESCE(v_order_status, 'null') || ')');
  END IF;

  IF v_payment_status = 'refunded' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Already refunded (payment_status)');
  END IF;

  PERFORM 1 FROM public.wallets
  WHERE wallets.user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'User wallet not found');
  END IF;

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

  v_refund_amount := v_wallet_deduction;
  IF v_refund_amount IS NULL OR v_refund_amount <= 0 THEN
    v_refund_amount := v_price_kobo;
  END IF;

  IF v_refund_amount IS NULL OR v_refund_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'No valid refund amount found');
  END IF;

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

  UPDATE public.wallets
  SET balance_kobo = balance_kobo + v_refund_amount, updated_at = now()
  WHERE wallets.user_id = v_user_id;

  SELECT balance_kobo INTO v_current_balance
  FROM public.wallets WHERE wallets.user_id = v_user_id;

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
