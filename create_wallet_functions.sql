-- Function to Process Purchase (Atomic Deduction + Order Creation)
-- Uses wallet_id for wallet_transactions (matches deployed schema)
CREATE OR REPLACE FUNCTION process_purchase(
  p_user_id uuid,
  p_service_type text,
  p_country text,
  p_price_ngn numeric,
  p_price_usd numeric,
  p_metadata jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance numeric;
  v_wallet_id uuid;
  v_order_id uuid;
  v_new_balance numeric;
BEGIN
  SELECT w.id, w.balance INTO v_wallet_id, v_current_balance
  FROM public.wallets w
  WHERE w.user_id = p_user_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    INSERT INTO public.wallets (user_id, balance) VALUES (p_user_id, 0)
    RETURNING id, balance INTO v_wallet_id, v_current_balance;
  END IF;

  IF v_current_balance < p_price_ngn THEN
    RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
  END IF;

  v_new_balance := v_current_balance - p_price_ngn;
  UPDATE public.wallets
  SET balance = v_new_balance, updated_at = now()
  WHERE wallets.id = v_wallet_id;

  INSERT INTO public.orders (
    user_id, service_type, price_usd, payment_status, status,
    payment_reference, metadata
  ) VALUES (
    p_user_id, p_service_type, p_price_usd, 'pending', 'pending',
    'WAL-' || gen_random_uuid(),
    p_metadata || jsonb_build_object('wallet_deduction', p_price_ngn, 'currency', 'NGN')
  )
  RETURNING id INTO v_order_id;

  INSERT INTO public.wallet_transactions (
    wallet_id, amount, type, reference
  ) VALUES (
    v_wallet_id, -p_price_ngn, 'purchase', v_order_id::text
  );

  RETURN jsonb_build_object('success', true, 'order_id', v_order_id, 'new_balance', v_new_balance);
END;
$$;

-- Function to Process Order Refund (Atomic Refund + Status Update)
-- Checks orders.status = 'refunded' (SMS lifecycle) before crediting
-- Uses wallet_id for wallet_transactions. No EXCEPTION WHEN OTHERS.
CREATE OR REPLACE FUNCTION process_order_refund(
  p_order_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_wallet_id uuid;
  v_payment_status text;
  v_order_status text;
  v_price_usd numeric;
  v_wallet_deduction numeric;
  v_refund_amount numeric;
  v_current_balance numeric;
BEGIN
  SELECT user_id, status, payment_status, price_usd, 
         (metadata->>'wallet_deduction')::numeric
  INTO v_user_id, v_order_status, v_payment_status, v_price_usd, v_wallet_deduction
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

  SELECT w.id INTO v_wallet_id
  FROM public.wallets w
  WHERE w.user_id = v_user_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'User wallet not found');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.wallet_transactions wt
    WHERE wt.reference = p_order_id::text 
      AND wt.type = 'refund'
  ) THEN
    UPDATE public.orders 
    SET payment_status = 'refunded', updated_at = now()
    WHERE orders.id = p_order_id;
    RETURN jsonb_build_object('success', false, 'message', 'Already refunded (transaction exists)');
  END IF;

  v_refund_amount := v_wallet_deduction;
  IF v_refund_amount IS NULL OR v_refund_amount <= 0 THEN
    v_refund_amount := v_price_usd;
  END IF;
  
  IF v_refund_amount IS NULL OR v_refund_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'No valid refund amount found');
  END IF;

  INSERT INTO public.wallet_transactions (
    wallet_id, amount, type, reference
  ) VALUES (
    v_wallet_id, v_refund_amount, 'refund', p_order_id::text
  );

  UPDATE public.wallets
  SET balance = balance + v_refund_amount, updated_at = now()
  WHERE wallets.id = v_wallet_id;

  SELECT balance INTO v_current_balance
  FROM public.wallets WHERE wallets.id = v_wallet_id;

  UPDATE public.orders
  SET payment_status = 'refunded', updated_at = now()
  WHERE orders.id = p_order_id;

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Refund processed', 
    'amount', v_refund_amount,
    'new_balance', v_current_balance
  );
END;
$$;
