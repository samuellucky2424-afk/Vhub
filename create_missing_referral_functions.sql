-- ============================================================
-- CREATE MISSING REFERRAL RPC FUNCTIONS
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1️⃣ get_user_referral_code - Returns user's referral code or generates one
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
    v_new_code := '';
    FOR i IN 1..5 LOOP
      v_new_code := v_new_code || substr(v_chars, floor(random() * length(v_chars) + 1)::int, 1);
    END LOOP;

    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM public.referrals WHERE referral_code = v_new_code) INTO v_existing_code;

    EXIT WHEN NOT v_existing_code;

    v_attempts := v_attempts + 1;
    IF v_attempts > 100 THEN
      RAISE EXCEPTION 'Could not generate unique referral code after 100 attempts';
    END IF;
  END LOOP;

  -- Insert the new code
  INSERT INTO public.referrals (user_id, referral_code)
  VALUES (p_user_id, v_new_code);

  RETURN v_new_code;
END;
$$;

-- 2️⃣ get_user_referrals - Returns referral usages for a user's code
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
-- GRANTS FOR AUTHENTICATED ROLE
-- ============================================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_referral_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_referrals(uuid) TO authenticated;

-- Grant select permissions on referral tables for the functions to work
GRANT SELECT ON public.referrals TO authenticated;
GRANT SELECT ON public.referral_usages TO authenticated;
GRANT SELECT ON auth.users TO authenticated;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Test the functions:
-- SELECT * FROM get_user_referral_code('your-user-id-here');
-- SELECT * FROM get_user_referrals('your-user-id-here');

-- Check if functions exist:
-- \df get_user_referral_code
-- \df get_user_referrals

-- ============================================================
-- DONE!
-- ============================================================
