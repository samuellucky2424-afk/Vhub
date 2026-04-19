-- Function to Credit Wallet (Atomic Deposit + Transaction Log)
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
  v_wallet_id uuid;
  v_current_balance numeric;
  v_existing_tx_id uuid;
  v_new_balance numeric;
BEGIN
  -- 1. Idempotency Check: Check if transaction with this reference already exists
  -- We check wallet_transactions for type 'deposit' and the same reference
  SELECT id INTO v_existing_tx_id
  FROM public.wallet_transactions
  WHERE reference = p_reference AND type = 'deposit';

  IF v_existing_tx_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'message', 'Transaction already processed', 'transaction_id', v_existing_tx_id);
  END IF;

  -- 2. Lock Wallet Row for Update
  SELECT id, balance INTO v_wallet_id, v_current_balance
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    -- Auto-create wallet if not exists (First deposit)
    INSERT INTO public.wallets (user_id, balance) VALUES (p_user_id, 0)
    RETURNING id, balance INTO v_wallet_id, v_current_balance;
  END IF;

  -- 3. Credit Balance
  v_new_balance := v_current_balance + p_amount;
  UPDATE public.wallets
  SET balance = v_new_balance, updated_at = now()
  WHERE id = v_wallet_id;

  -- 4. Log Transaction
  INSERT INTO public.wallet_transactions (
    wallet_id,
    amount,
    type,
    reference,
    description,
    created_at
  ) VALUES (
    v_wallet_id,
    p_amount,
    'deposit',
    p_reference,
    p_metadata->>'description',
    now()
  );

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance, 'message', 'Wallet credited successfully');

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;
