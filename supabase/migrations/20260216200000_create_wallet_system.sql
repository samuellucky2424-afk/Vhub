-- Create Wallets Table
CREATE TABLE IF NOT EXISTS public.wallets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL UNIQUE,
  balance numeric DEFAULT 0 CHECK (balance >= 0),
  currency text DEFAULT 'NGN',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Wallets
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own wallet" ON public.wallets;
CREATE POLICY "Users can view own wallet"
  ON public.wallets FOR SELECT
  USING (auth.uid() = user_id);

-- Create Wallet Transactions Table
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id uuid REFERENCES public.wallets(id) NOT NULL,
  amount numeric NOT NULL,
  type text NOT NULL CHECK (type IN ('deposit', 'purchase', 'refund', 'adjustment')),
  reference text, -- Order ID or Payment Reference
  description text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Transactions
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own transactions" ON public.wallet_transactions;
CREATE POLICY "Users can view own transactions"
  ON public.wallet_transactions FOR SELECT
  USING (auth.uid() = (SELECT user_id FROM public.wallets WHERE id = wallet_transactions.wallet_id));

-- Update Orders table verification
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check 
  CHECK (payment_status IN ('pending', 'paid', 'failed', 'completed', 'refunded', 'cancelled'));

-- Function to Process Purchase (Atomic Deduction + Order Creation)
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
  v_order_id uuid;
  v_new_balance numeric;
BEGIN
  -- 1. Lock Wallet Row for Update (using user_id)
  SELECT balance INTO v_current_balance
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    -- Auto-create wallet if not exists
    INSERT INTO public.wallets (user_id, balance) VALUES (p_user_id, 0)
    RETURNING balance INTO v_current_balance;
  END IF;

  -- 2. Check Sufficient Funds
  IF v_current_balance < p_price_ngn THEN
    RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
  END IF;

  -- 3. Deduct Balance
  v_new_balance := v_current_balance - p_price_ngn;
  UPDATE public.wallets
  SET balance = v_new_balance, updated_at = now()
  WHERE user_id = p_user_id;

  -- 4. Create Order
  INSERT INTO public.orders (
    user_id,
    service_type,
    price_usd,
    payment_status,
    payment_reference,
    metadata
  ) VALUES (
    p_user_id,
    p_service_type,
    p_price_usd,
    'pending',
    'WAL-' || gen_random_uuid(),
    p_metadata || jsonb_build_object('wallet_deduction', p_price_ngn, 'currency', 'NGN')
  )
  RETURNING id INTO v_order_id;

  -- 5. Log Transaction
  INSERT INTO public.wallet_transactions (
    user_id,
    amount,
    type,
    reference
  ) VALUES (
    p_user_id,
    -p_price_ngn,
    'purchase',
    v_order_id::text
  );

  RETURN jsonb_build_object('success', true, 'order_id', v_order_id, 'new_balance', v_new_balance);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- Function to Process Order Refund (Atomic Refund + Status Update)
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

  -- 2. Validate Refund Eligibility (accept pending or paid)
  IF v_payment_status NOT IN ('pending', 'paid') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order not eligible for refund (status: ' || v_payment_status || ')');
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
  v_refund_amount := v_wallet_deduction;
  IF v_refund_amount IS NULL OR v_refund_amount <= 0 THEN
      v_refund_amount := v_price_usd;
  END IF;
  
  IF v_refund_amount IS NULL OR v_refund_amount <= 0 THEN
     RETURN jsonb_build_object('success', false, 'message', 'No valid refund amount found in metadata');
  END IF;

  -- 5. Refund Wallet (using user_id, no wallets.id column)
  UPDATE public.wallets
  SET balance = balance + v_refund_amount, updated_at = now()
  WHERE user_id = v_user_id;

  IF NOT FOUND THEN
     RETURN jsonb_build_object('success', false, 'message', 'User wallet not found');
  END IF;

  SELECT balance INTO v_current_balance
  FROM public.wallets WHERE public.wallets.user_id = v_user_id;

  -- 6. Update Order Status
  UPDATE public.orders
  SET payment_status = 'refunded', updated_at = now()
  WHERE id = p_order_id;

  -- 7. Log Transaction
  INSERT INTO public.wallet_transactions (
    user_id,
    amount,
    type,
    reference
  ) VALUES (
    v_user_id,
    v_refund_amount,
    'refund',
    p_order_id::text
  );

  RETURN jsonb_build_object('success', true, 'message', 'Refund processed', 'amount', v_refund_amount, 'new_balance', v_current_balance);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

