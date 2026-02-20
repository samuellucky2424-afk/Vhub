-- ============================================================
-- FINAL REFERRAL SYSTEM FIX (SAFE + IDPOTENT)
-- Fixes:
--  - substr() type error (casts start position to int)
--  - get_user_referrals return type mismatch
--  - 404/400 RPC errors by dropping/recreating functions
--  - 406 RLS errors by defining correct restrictive policies
--
-- IMPORTANT:
--  - Does NOT disable RLS
--  - Does NOT allow cross-user reads
--  - Does NOT modify wallet/auth tables
-- ============================================================

-- 0) Ensure schema exists (public does in Supabase)

-- 1) DROP FUNCTIONS (required)
DROP FUNCTION IF EXISTS public.get_user_referral_code(uuid);
DROP FUNCTION IF EXISTS public.generate_referral_code(uuid);
DROP FUNCTION IF EXISTS public.get_user_referrals(uuid);
DROP FUNCTION IF EXISTS public.validate_and_use_referral_code(text, uuid);

-- 2) (Optional) Ensure tables exist (no destructive changes)
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code varchar(5) NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.referral_usages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  referral_code varchar(5) NOT NULL REFERENCES public.referrals(referral_code) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_credited boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'referrals_user_id_unique'
      AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    ALTER TABLE public.referrals
      ADD CONSTRAINT referrals_user_id_unique UNIQUE (user_id);
  END IF;
END $$;

-- 3) RECREATE FUNCTIONS (fixed)

-- 3.1) get_user_referral_code: returns existing code or creates ONCE
CREATE OR REPLACE FUNCTION public.get_user_referral_code(p_user_id uuid)
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
  SELECT r.referral_code
    INTO v_existing_code
  FROM public.referrals r
  WHERE r.user_id = p_user_id;

  IF v_existing_code IS NOT NULL THEN
    RETURN v_existing_code;
  END IF;

  LOOP
    v_attempts := v_attempts + 1;
    v_new_code := '';

    FOR i IN 1..5 LOOP
      v_new_code := v_new_code || substr(
        v_chars,
        (floor(random() * length(v_chars)) + 1)::int,
        1
      );
    END LOOP;

    IF NOT EXISTS (
      SELECT 1
      FROM public.referrals r2
      WHERE r2.referral_code = v_new_code
    ) THEN
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

-- 3.2) generate_referral_code: kept for backward compatibility, but uses same logic
CREATE OR REPLACE FUNCTION public.generate_referral_code(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN public.get_user_referral_code(p_user_id);
END;
$$;

-- 3.3) get_user_referrals: return types MUST match referral_usages column types
-- NOTE: Your table uses "timestamp with time zone" in the safe script. If your actual column is
-- timestamp without time zone, change the line below accordingly.
CREATE OR REPLACE FUNCTION public.get_user_referrals(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  referral_code varchar,
  referred_user_id uuid,
  reward_credited boolean,
  created_at timestamp
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
  JOIN public.referrals r
    ON r.referral_code = ru.referral_code
  WHERE r.user_id = p_user_id
  ORDER BY ru.created_at DESC;
END;
$$;

-- 3.4) validate_and_use_referral_code
CREATE OR REPLACE FUNCTION public.validate_and_use_referral_code(
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
  v_referrer_user_id uuid;
BEGIN
  -- Ensure referral exists and capture owner
  SELECT r.user_id
    INTO v_referrer_user_id
  FROM public.referrals r
  WHERE r.referral_code = p_code;

  IF v_referrer_user_id IS NULL THEN
    RETURN QUERY SELECT false, 'Invalid referral code', p_code;
    RETURN;
  END IF;

  IF v_referrer_user_id = p_referred_user_id THEN
    RETURN QUERY SELECT false, 'Cannot use your own referral code', p_code;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.referral_usages ru
    WHERE ru.referred_user_id = p_referred_user_id
  ) THEN
    RETURN QUERY SELECT false, 'Referral already used by this user', p_code;
    RETURN;
  END IF;

  INSERT INTO public.referral_usages (referral_code, referred_user_id)
  VALUES (p_code, p_referred_user_id);

  RETURN QUERY SELECT true, 'Referral code applied successfully', p_code;
END;
$$;

-- 4) RLS + POLICIES (restrictive; no cross-user access)
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_usages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "Users can view own referral" ON public.referrals;
DROP POLICY IF EXISTS "Users can insert own referral" ON public.referrals;
DROP POLICY IF EXISTS "Anyone can look up referral codes" ON public.referrals;

DROP POLICY IF EXISTS "Users can view own referral usages" ON public.referral_usages;
DROP POLICY IF EXISTS "Referred users can view own usage" ON public.referral_usages;
DROP POLICY IF EXISTS "Users can insert referral usage for self" ON public.referral_usages;

-- Referrals: user can read their own record
CREATE POLICY "Users can view own referral"
  ON public.referrals
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Referrals: user can create their own record (used by SECURITY DEFINER too; safe)
CREATE POLICY "Users can insert own referral"
  ON public.referrals
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- IMPORTANT: no global SELECT policy (removes 406 without opening cross-user access)
-- Validation should use the SECURITY DEFINER function validate_and_use_referral_code.

-- Referral usages: referrer can read usage rows tied to THEIR code
CREATE POLICY "Users can view own referral usages"
  ON public.referral_usages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.referrals r
      WHERE r.referral_code = referral_usages.referral_code
        AND r.user_id = auth.uid()
    )
  );

-- Referral usages: referred user can read their own usage row
CREATE POLICY "Referred users can view own usage"
  ON public.referral_usages
  FOR SELECT
  TO authenticated
  USING (referred_user_id = auth.uid());

-- Referral usages: authenticated user can insert a usage for THEMSELVES only
CREATE POLICY "Users can insert referral usage for self"
  ON public.referral_usages
  FOR INSERT
  TO authenticated
  WITH CHECK (referred_user_id = auth.uid());

-- 5) Grants (RPCs are called via PostgREST)
GRANT EXECUTE ON FUNCTION public.get_user_referral_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_referral_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_referrals(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_and_use_referral_code(text, uuid) TO authenticated;

GRANT SELECT, INSERT ON public.referrals TO authenticated;
GRANT SELECT, INSERT ON public.referral_usages TO authenticated;

-- 6) Quick verification
SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS identity_args,
  p.prorettype::regtype AS return_type
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'get_user_referral_code',
    'generate_referral_code',
    'get_user_referrals',
    'validate_and_use_referral_code'
  )
ORDER BY p.proname;
