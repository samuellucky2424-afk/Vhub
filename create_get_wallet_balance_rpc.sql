-- =============================================================
-- get_wallet_balance — SECURITY DEFINER function to read wallet
--
-- This bypasses RLS completely (runs as DB owner).
-- Use this from edge functions instead of direct table queries.
--
-- Run this in Supabase SQL Editor.
-- =============================================================

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
    -- Auto-create wallet if it doesn't exist
    INSERT INTO public.wallets (user_id, balance_kobo, currency)
    VALUES (p_user_id, 0, 'NGN')
    ON CONFLICT (user_id) DO NOTHING;

    -- Re-fetch after insert
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
    'balance', COALESCE(v_wallet.balance, 0),
    'currency', COALESCE(v_wallet.currency, 'NGN'),
    'user_id', v_wallet.user_id
  );
END;
$$;

-- Verify
SELECT 'get_wallet_balance function created successfully' AS result;
