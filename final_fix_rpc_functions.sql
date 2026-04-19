-- ============================================================
-- FINAL FIX FOR ALL RPC AND PERMISSION ISSUES
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1️⃣ DROP AND RECREATE ALL FUNCTIONS WITH COMPATIBLE SYNTAX
-- Fix PostgreSQL version compatibility issues

DROP FUNCTION IF EXISTS get_user_referral_code(uuid);
CREATE OR REPLACE FUNCTION get_user_referral_code(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_code text;
  v_new_code text;
  v_chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  v_attempts integer := 0;
  v_max_attempts integer := 100;
BEGIN
  -- Check if user already has a code
  SELECT referral_code INTO v_existing_code
  FROM public.referrals
  WHERE user_id = p_user_id;
  
  IF v_existing_code IS NOT NULL THEN
    RETURN v_existing_code;
  END IF;
  
  -- Generate unique code
  LOOP
    v_attempts := v_attempts + 1;
    v_new_code := '';
    
    -- Generate 5-character code using compatible syntax
    FOR i IN 1..5 LOOP
      v_new_code := v_new_code || substring(v_chars, floor(random() * length(v_chars)) + 1, 1);
    END LOOP;
    
    -- Check uniqueness
    IF NOT EXISTS (
      SELECT 1 FROM public.referrals 
      WHERE referral_code = v_new_code
    ) THEN
      -- Insert and return
      INSERT INTO public.referrals (user_id, referral_code)
      VALUES (p_user_id, v_new_code);
      
      RETURN v_new_code;
    END IF;
    
    IF v_attempts >= v_max_attempts THEN
      RAISE EXCEPTION 'Could not generate unique referral code after % attempts', v_max_attempts;
    END IF;
  END LOOP;
END;
$$;

DROP FUNCTION IF EXISTS get_user_referrals(uuid);
CREATE OR REPLACE FUNCTION get_user_referrals(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  referral_code text,
  referred_user_id uuid,
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
    ru.reward_credited,
    ru.created_at
  FROM public.referral_usages ru
  JOIN public.referrals r ON ru.referral_code = r.referral_code
  WHERE r.user_id = p_user_id
  ORDER BY ru.created_at DESC;
END;
$$;

DROP FUNCTION IF EXISTS generate_referral_code(uuid);
CREATE OR REPLACE FUNCTION generate_referral_code(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_code text;
  v_new_code text;
  v_chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  v_attempts integer := 0;
  v_max_attempts integer := 100;
BEGIN
  -- Check if user already has a code
  SELECT referral_code INTO v_existing_code
  FROM public.referrals
  WHERE user_id = p_user_id;
  
  IF v_existing_code IS NOT NULL THEN
    RETURN v_existing_code;
  END IF;
  
  -- Generate unique code
  LOOP
    v_attempts := v_attempts + 1;
    v_new_code := '';
    
    -- Generate 5-character code using compatible syntax
    FOR i IN 1..5 LOOP
      v_new_code := v_new_code || substring(v_chars, floor(random() * length(v_chars)) + 1, 1);
    END LOOP;
    
    -- Check uniqueness
    IF NOT EXISTS (
      SELECT 1 FROM public.referrals 
      WHERE referral_code = v_new_code
    ) THEN
      -- Insert and return
      INSERT INTO public.referrals (user_id, referral_code)
      VALUES (p_user_id, v_new_code);
      
      RETURN v_new_code;
    END IF;
    
    IF v_attempts >= v_max_attempts THEN
      RAISE EXCEPTION 'Could not generate unique referral code after % attempts', v_max_attempts;
    END IF;
  END LOOP;
END;
$$;

DROP FUNCTION IF EXISTS validate_and_use_referral_code(text, uuid);
CREATE OR REPLACE FUNCTION validate_and_use_referral_code(
  p_code text,
  p_referred_user_id uuid
)
RETURNS TABLE (
  success boolean,
  message text,
  referral_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_referral_exists boolean;
  v_already_used boolean;
  v_self_referral boolean;
BEGIN
  -- Check if referral code exists
  SELECT EXISTS (
    SELECT 1 FROM public.referrals 
    WHERE referral_code = p_code
  ) INTO v_referral_exists;
  
  IF NOT v_referral_exists THEN
    RETURN QUERY SELECT false, 'Invalid referral code', p_code;
    RETURN;
  END IF;
  
  -- Check if user is trying to refer themselves
  SELECT EXISTS (
    SELECT 1 FROM public.referrals 
    WHERE referral_code = p_code 
    AND user_id = p_referred_user_id
  ) INTO v_self_referral;
  
  IF v_self_referral THEN
    RETURN QUERY SELECT false, 'Cannot use your own referral code', p_code;
    RETURN;
  END IF;
  
  -- Check if already used
  SELECT EXISTS (
    SELECT 1 FROM public.referral_usages 
    WHERE referral_code = p_code 
    AND referred_user_id = p_referred_user_id
  ) INTO v_already_used;
  
  IF v_already_used THEN
    RETURN QUERY SELECT false, 'Referral code already used', p_code;
    RETURN;
  END IF;
  
  -- Record usage
  INSERT INTO public.referral_usages (referral_code, referred_user_id)
  VALUES (p_code, p_referred_user_id);
  
  RETURN QUERY SELECT true, 'Referral code applied successfully', p_code;
END;
$$;

-- 2️⃣ FIX TABLE PERMISSIONS COMPLETELY
-- Drop and recreate all policies to ensure they work

DROP POLICY IF EXISTS "Users can view own referral" ON public.referrals;
DROP POLICY IF EXISTS "Anyone can look up referral codes" ON public.referrals;
DROP POLICY IF EXISTS "Users can insert own referral" ON public.referrals;

DROP POLICY IF EXISTS "Users can view own referral usages" ON public.referral_usages;
DROP POLICY IF EXISTS "Referred users can view own usage" ON public.referral_usages;
DROP POLICY IF EXISTS "System can insert referral usages" ON public.referral_usages;

-- Recreate policies with correct syntax
CREATE POLICY "Users can view own referral"
  ON public.referrals
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can look up referral codes"
  ON public.referrals
  FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own referral"
  ON public.referrals
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own referral usages"
  ON public.referral_usages
  FOR SELECT
  USING (
    referral_code IN (
      SELECT r.referral_code 
      FROM public.referrals r 
      WHERE r.user_id = auth.uid()
    )
  );

CREATE POLICY "Referred users can view own usage"
  ON public.referral_usages
  FOR SELECT
  USING (referred_user_id = auth.uid());

CREATE POLICY "System can insert referral usages"
  ON public.referral_usages
  FOR INSERT
  WITH CHECK (true);

-- 3️⃣ GRANT ALL PERMISSIONS
GRANT EXECUTE ON FUNCTION get_user_referral_code TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_referrals TO authenticated;
GRANT EXECUTE ON FUNCTION generate_referral_code TO authenticated;
GRANT EXECUTE ON FUNCTION validate_and_use_referral_code TO authenticated;

GRANT SELECT ON public.referrals TO authenticated;
GRANT INSERT ON public.referrals TO authenticated;
GRANT SELECT ON public.referral_usages TO authenticated;
GRANT INSERT ON public.referral_usages TO authenticated;

-- 4️⃣ ENSURE RLS IS ENABLED
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_usages ENABLE ROW LEVEL SECURITY;

-- 5️⃣ VERIFICATION
SELECT 
    proname as function_name,
    pg_get_function_arguments(oid) as arguments,
    prorettype::regtype as return_type
FROM pg_proc 
WHERE proname IN ('get_user_referral_code', 'get_user_referrals', 'generate_referral_code', 'validate_and_use_referral_code')
    AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- ============================================================
-- DONE!
-- ============================================================
