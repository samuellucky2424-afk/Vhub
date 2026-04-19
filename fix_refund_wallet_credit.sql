-- =============================================================
-- FIX: Wallet Refund Not Crediting Balance (v2)
-- 
-- PROBLEM: process_order_refund referenced columns (wallets.id, 
--          wallet_transactions.wallet_id) that don't exist in the
--          deployed schema. Refunds silently fail.
--
-- Run this ENTIRE script in Supabase SQL Editor.
-- =============================================================

-- Step 1: Replace the broken process_order_refund function
-- Uses user_id everywhere (matches deployed schema)
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
  v_current_balance numeric;
BEGIN
  -- 1. Lock and get order details
  SELECT user_id, payment_status, price_usd, 
         (metadata->>'wallet_deduction')::numeric
  INTO v_user_id, v_payment_status, v_price_usd, v_wallet_deduction
  FROM public.orders
  WHERE orders.id = p_order_id
  FOR UPDATE;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order not found');
  END IF;

  -- 2. Validate eligibility (pending or paid only)
  IF v_payment_status NOT IN ('pending', 'paid') THEN
    RETURN jsonb_build_object('success', false, 'message', 
      'Order not eligible for refund (status: ' || v_payment_status || ')');
  END IF;

  -- 3. Double-refund guard: check wallet_transactions
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

  -- 5. Credit wallet using user_id (no wallets.id column exists)
  UPDATE public.wallets
  SET balance = balance + v_refund_amount,
      updated_at = now()
  WHERE wallets.user_id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'User wallet not found');
  END IF;

  SELECT balance INTO v_current_balance
  FROM public.wallets WHERE wallets.user_id = v_user_id;

  -- 6. Update order status to refunded
  UPDATE public.orders
  SET payment_status = 'refunded'
  WHERE orders.id = p_order_id;

  -- 7. Log refund transaction (use user_id since wallet_id column doesn't exist)
  INSERT INTO public.wallet_transactions (
    user_id, amount, type, reference
  ) VALUES (
    v_user_id,
    v_refund_amount,
    'refund',
    p_order_id::text
  );

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Refund processed', 
    'amount', v_refund_amount,
    'new_balance', v_current_balance
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- =============================================================
-- Step 2: Reset the 5 stuck orders to 'pending' so the RPC can process them
-- =============================================================
UPDATE public.orders 
SET payment_status = 'pending'
WHERE id IN (
    '55e47f7e-d2d9-4a52-8052-d00869c9d381',
    '2f96c610-1379-4e0a-8555-68e738c87ab7',
    '1acbdd05-211d-4b83-b182-cc033cbbcec7',
    'ed2f6ca9-dcc5-4432-8ef1-954093dfc2a8',
    '68a3aaca-848a-464b-bf20-0631b1f88418'
)
AND payment_status = 'refunded';

-- =============================================================
-- Step 3: Process refunds (each returns JSON with success/amount)
-- =============================================================
SELECT process_order_refund('55e47f7e-d2d9-4a52-8052-d00869c9d381'::uuid) AS refund_1;
SELECT process_order_refund('2f96c610-1379-4e0a-8555-68e738c87ab7'::uuid) AS refund_2;
SELECT process_order_refund('1acbdd05-211d-4b83-b182-cc033cbbcec7'::uuid) AS refund_3;
SELECT process_order_refund('ed2f6ca9-dcc5-4432-8ef1-954093dfc2a8'::uuid) AS refund_4;
SELECT process_order_refund('68a3aaca-848a-464b-bf20-0631b1f88418'::uuid) AS refund_5;

-- =============================================================
-- Step 4: Verify — check wallet balances and refund transactions
-- =============================================================
SELECT 'WALLET BALANCES' AS check_type;
SELECT user_id, balance FROM public.wallets 
WHERE user_id IN (
    SELECT user_id FROM public.orders WHERE id IN (
        '55e47f7e-d2d9-4a52-8052-d00869c9d381',
        '2f96c610-1379-4e0a-8555-68e738c87ab7',
        '1acbdd05-211d-4b83-b182-cc033cbbcec7',
        'ed2f6ca9-dcc5-4432-8ef1-954093dfc2a8',
        '68a3aaca-848a-464b-bf20-0631b1f88418'
    )
);

SELECT 'REFUND TRANSACTIONS' AS check_type;
SELECT user_id, amount, type, reference, created_at
FROM public.wallet_transactions 
WHERE type = 'refund'
ORDER BY created_at DESC
LIMIT 10;
