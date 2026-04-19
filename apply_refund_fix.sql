-- =============================================================
-- REFUND FIX v4 - All-in-one script
-- Run this ENTIRE script in Supabase SQL Editor
-- =============================================================

-- Step 1: Fix the constraint
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check 
  CHECK (payment_status IN ('pending', 'paid', 'completed', 'refunded', 'failed', 'cancelled', 'manual_intervention_required'));

-- Step 2: Create the refund function using user_id as wallet key (no wallets.id needed)
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
  v_price_usd numeric;
  v_wallet_deduction numeric;
  v_refund_amount numeric;
BEGIN
  -- 1. Get order details
  SELECT user_id, payment_status, price_usd, 
         (metadata->>'wallet_deduction')::numeric
  INTO v_user_id, v_payment_status, v_price_usd, v_wallet_deduction
  FROM public.orders
  WHERE orders.id = p_order_id
  FOR UPDATE;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order not found');
  END IF;

  -- 2. Validate eligibility
  IF v_payment_status NOT IN ('pending', 'paid') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order not eligible for refund (status: ' || v_payment_status || ')');
  END IF;

  -- 3. Double-refund guard
  IF EXISTS (
    SELECT 1 FROM public.wallet_transactions wt
    WHERE wt.reference = p_order_id::text 
      AND wt.type = 'refund'
  ) THEN
    UPDATE public.orders SET payment_status = 'refunded'
    WHERE orders.id = p_order_id;
    RETURN jsonb_build_object('success', false, 'message', 'Already refunded');
  END IF;

  -- 4. Determine refund amount
  v_refund_amount := v_wallet_deduction;
  IF v_refund_amount IS NULL OR v_refund_amount <= 0 THEN
    v_refund_amount := v_price_usd;
  END IF;
  
  IF v_refund_amount IS NULL OR v_refund_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'No valid refund amount');
  END IF;

  -- 5. Refund wallet directly using user_id (no wallets.id reference)
  UPDATE public.wallets
  SET balance = balance + v_refund_amount
  WHERE wallets.user_id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'User wallet not found');
  END IF;

  -- 6. Update order status
  UPDATE public.orders
  SET payment_status = 'refunded'
  WHERE orders.id = p_order_id;

  -- 7. Log refund transaction
  INSERT INTO public.wallet_transactions (
    wallet_id, amount, type, reference, description
  ) VALUES (
    (SELECT w.user_id FROM public.wallets w WHERE w.user_id = v_user_id LIMIT 1),
    v_refund_amount,
    'refund',
    p_order_id::text,
    'Refund for expired order ' || p_order_id
  );

  RETURN jsonb_build_object('success', true, 'message', 'Refund processed', 'amount', v_refund_amount);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- Step 3: Reset the 5 orders to 'pending' so they're eligible for refund
UPDATE public.orders 
SET payment_status = 'pending'
WHERE orders.id IN (
    '55e47f7e-d2d9-4a52-8052-d00869c9d381',
    '2f96c610-1379-4e0a-8555-68e738c87ab7',
    '1acbdd05-211d-4b83-b182-cc033cbbcec7',
    'ed2f6ca9-dcc5-4432-8ef1-954093dfc2a8',
    '68a3aaca-848a-464b-bf20-0631b1f88418'
)
AND orders.payment_status = 'refunded';

-- Step 4: Process refunds
SELECT process_order_refund('55e47f7e-d2d9-4a52-8052-d00869c9d381'::uuid) AS refund_1;
SELECT process_order_refund('2f96c610-1379-4e0a-8555-68e738c87ab7'::uuid) AS refund_2;
SELECT process_order_refund('1acbdd05-211d-4b83-b182-cc033cbbcec7'::uuid) AS refund_3;
SELECT process_order_refund('ed2f6ca9-dcc5-4432-8ef1-954093dfc2a8'::uuid) AS refund_4;
SELECT process_order_refund('68a3aaca-848a-464b-bf20-0631b1f88418'::uuid) AS refund_5;
