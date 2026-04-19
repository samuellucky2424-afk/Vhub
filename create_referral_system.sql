-- ============================================================
-- REFERRAL SYSTEM — Tables, Functions, Trigger, RLS Policies
-- Run this entire script in the Supabase SQL Editor.
-- ============================================================

-- ============================================================
-- 1. TABLES
-- ============================================================

-- 1a. Referrals table — one row per user, stores their unique code
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL UNIQUE,
  referral_code varchar(5) NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own referral" ON public.referrals;
CREATE POLICY "Users can view own referral"
  ON public.referrals FOR SELECT
  USING (auth.uid() = user_id);

-- Allow authenticated users to read any referral (needed to validate codes on signup)
DROP POLICY IF EXISTS "Anyone can look up referral codes" ON public.referrals;
CREATE POLICY "Anyone can look up referral codes"
  ON public.referrals FOR SELECT
  USING (true);

-- 1b. Referral usages table — tracks who used which code
CREATE TABLE IF NOT EXISTS public.referral_usages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  referral_code varchar(5) NOT NULL REFERENCES public.referrals(referral_code),
  referred_user_id uuid NOT NULL REFERENCES auth.users(id) UNIQUE,
  reward_credited boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.referral_usages ENABLE ROW LEVEL SECURITY;

-- Users can see usages of their own referral code
DROP POLICY IF EXISTS "Users can view own referral usages" ON public.referral_usages;
CREATE POLICY "Users can view own referral usages"
  ON public.referral_usages FOR SELECT
  USING (
    referral_code IN (
      SELECT r.referral_code FROM public.referrals r WHERE r.user_id = auth.uid()
    )
  );

-- Users can also see their own referred entry
DROP POLICY IF EXISTS "Referred users can view own usage" ON public.referral_usages;
CREATE POLICY "Referred users can view own usage"
  ON public.referral_usages FOR SELECT
  USING (referred_user_id = auth.uid());


-- ============================================================
-- 2. UPDATE wallet_transactions TYPE CONSTRAINT
--    Add 'referral_reward' without affecting existing rows
-- ============================================================

ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_type_check
  CHECK (type IN ('deposit', 'purchase', 'refund', 'adjustment', 'referral_reward'));


-- ============================================================
-- 3. RPC FUNCTIONS
-- ============================================================

-- 3a. generate_referral_code — creates a unique 5-char code for a user
CREATE OR REPLACE FUNCTION generate_referral_code(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code text;
  v_exists boolean;
  v_attempts integer := 0;
  v_chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  v_existing_code text;
BEGIN
  -- Check if user already has a code
  SELECT referral_code INTO v_existing_code
  FROM public.referrals
  WHERE user_id = p_user_id;

  IF v_existing_code IS NOT NULL THEN
    RETURN v_existing_code;
  END IF;

  -- Generate a unique 5-char code
  LOOP
    v_code := '';
    FOR i IN 1..5 LOOP
      v_code := v_code || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
    END LOOP;

    SELECT EXISTS(SELECT 1 FROM public.referrals WHERE referral_code = v_code) INTO v_exists;

    EXIT WHEN NOT v_exists;

    v_attempts := v_attempts + 1;
    IF v_attempts > 100 THEN
      RAISE EXCEPTION 'Could not generate unique referral code after 100 attempts';
    END IF;
  END LOOP;

  INSERT INTO public.referrals (user_id, referral_code)
  VALUES (p_user_id, v_code);

  RETURN v_code;
END;
$$;


-- 3b. validate_and_use_referral_code — validates and records code usage
CREATE OR REPLACE FUNCTION validate_and_use_referral_code(
  p_code text,
  p_referred_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_referrer_user_id uuid;
  v_usage_count integer;
BEGIN
  -- 1. Check the code exists
  SELECT user_id INTO v_referrer_user_id
  FROM public.referrals
  WHERE referral_code = p_code;

  IF v_referrer_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid referral code');
  END IF;

  -- 2. Prevent self-referral
  IF v_referrer_user_id = p_referred_user_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'You cannot use your own referral code');
  END IF;

  -- 3. Check the referred user hasn't already used a code
  IF EXISTS (
    SELECT 1 FROM public.referral_usages WHERE referred_user_id = p_referred_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'You have already used a referral code');
  END IF;

  -- 4. Check usage limit (max 20)
  SELECT COUNT(*) INTO v_usage_count
  FROM public.referral_usages
  WHERE referral_code = p_code;

  IF v_usage_count >= 20 THEN
    RETURN jsonb_build_object('success', false, 'message', 'This referral code has reached its maximum usage limit');
  END IF;

  -- 5. Insert usage
  INSERT INTO public.referral_usages (referral_code, referred_user_id)
  VALUES (p_code, p_referred_user_id);

  RETURN jsonb_build_object('success', true, 'message', 'Referral code applied successfully');

EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('success', false, 'message', 'You have already used a referral code');
WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;


-- 3c. get_user_referral_code — returns the referral code for a user
CREATE OR REPLACE FUNCTION get_user_referral_code(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code text;
BEGIN
  SELECT referral_code INTO v_code
  FROM public.referrals
  WHERE user_id = p_user_id;

  RETURN v_code;
END;
$$;


-- 3d. get_user_referrals — returns list of referral usages for a user's code
CREATE OR REPLACE FUNCTION get_user_referrals(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  referral_code varchar(5),
  referred_user_id uuid,
  referred_email text,
  reward_credited boolean,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ru.id,
    ru.referral_code,
    ru.referred_user_id,
    au.email::text AS referred_email,
    ru.reward_credited,
    ru.created_at
  FROM public.referral_usages ru
  JOIN public.referrals r ON r.referral_code = ru.referral_code
  JOIN auth.users au ON au.id = ru.referred_user_id
  WHERE r.user_id = p_user_id
  ORDER BY ru.created_at DESC;
END;
$$;


-- ============================================================
-- 4. TRIGGER — Auto-credit referral reward after purchases
-- ============================================================

CREATE OR REPLACE FUNCTION check_referral_reward()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_purchasing_user_id uuid;
  v_referral_usage_id uuid;
  v_referral_code varchar(5);
  v_referrer_user_id uuid;
  v_referrer_wallet_id uuid;
  v_total_purchases numeric;
  v_reward_amount numeric := 1300; -- ₦1,300
  v_threshold numeric := 5000;    -- ₦5,000
BEGIN
  -- Only process purchase transactions
  IF NEW.type != 'purchase' THEN
    RETURN NEW;
  END IF;

  -- Get the purchasing user's ID from the wallet
  SELECT w.user_id INTO v_purchasing_user_id
  FROM public.wallets w
  WHERE w.id = NEW.wallet_id;

  IF v_purchasing_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if this user was referred and reward not yet credited
  SELECT ru.id, ru.referral_code
  INTO v_referral_usage_id, v_referral_code
  FROM public.referral_usages ru
  WHERE ru.referred_user_id = v_purchasing_user_id
    AND ru.reward_credited = false
  FOR UPDATE SKIP LOCKED;  -- Prevent race conditions

  IF v_referral_usage_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get the referrer's user_id
  SELECT r.user_id INTO v_referrer_user_id
  FROM public.referrals r
  WHERE r.referral_code = v_referral_code;

  IF v_referrer_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calculate total purchases for the referred user (purchases are negative amounts)
  SELECT COALESCE(ABS(SUM(wt.amount)), 0) INTO v_total_purchases
  FROM public.wallet_transactions wt
  JOIN public.wallets w ON w.id = wt.wallet_id
  WHERE w.user_id = v_purchasing_user_id
    AND wt.type = 'purchase';

  -- Check if threshold met
  IF v_total_purchases < v_threshold THEN
    RETURN NEW;
  END IF;

  -- Get referrer's wallet (create if needed)
  SELECT w.id INTO v_referrer_wallet_id
  FROM public.wallets w
  WHERE w.user_id = v_referrer_user_id
  FOR UPDATE;

  IF v_referrer_wallet_id IS NULL THEN
    INSERT INTO public.wallets (user_id, balance)
    VALUES (v_referrer_user_id, 0)
    RETURNING id INTO v_referrer_wallet_id;
  END IF;

  -- Credit the referrer's wallet
  UPDATE public.wallets
  SET balance = balance + v_reward_amount, updated_at = now()
  WHERE id = v_referrer_wallet_id;

  -- Log the reward transaction
  INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, description)
  VALUES (
    v_referrer_wallet_id,
    v_reward_amount,
    'referral_reward',
    v_referral_usage_id::text,
    'Referral reward: referred user reached ₦' || v_threshold || ' in purchases'
  );

  -- Mark reward as credited (prevents double-credit)
  UPDATE public.referral_usages
  SET reward_credited = true
  WHERE id = v_referral_usage_id;

  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_check_referral_reward ON public.wallet_transactions;
CREATE TRIGGER trg_check_referral_reward
  AFTER INSERT ON public.wallet_transactions
  FOR EACH ROW
  EXECUTE FUNCTION check_referral_reward();


-- ============================================================
-- 5. ENABLE REALTIME (optional, for live updates)
-- ============================================================

-- Allow realtime subscriptions on referrals table
ALTER PUBLICATION supabase_realtime ADD TABLE public.referrals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.referral_usages;


-- ============================================================
-- DONE! Verify by checking:
--   SELECT * FROM public.referrals;
--   SELECT * FROM public.referral_usages;
--   \df check_referral_reward
-- ============================================================
