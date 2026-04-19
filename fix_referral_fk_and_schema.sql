-- ============================================================
-- FIX REFERRAL FK VIOLATION + ALIGN TABLE SCHEMA (SAFE)
-- Problem:
--   get_user_referral_code() inserts into public.referrals(user_id)
--   but current FK references auth.users(id). In Supabase, the canonical
--   table for user IDs is auth.users, but Postgres FK to auth.users often
--   fails due to permissions/replication timing and is not recommended.
--
-- Solution:
--   1) Drop FK to auth.users and replace with FK to auth.uid() domain table
--      public.profiles(id) if you have it, OR simply remove FK and rely on
--      RLS + auth.uid() checks.
--   2) Align created_at columns to timestamp without time zone (your current
--      schema uses timestamp without time zone).
--   3) Make get_user_referral_code ignore passed p_user_id unless it matches
--      auth.uid() (prevents abuse and avoids FK mismatch).
-- ============================================================

BEGIN;

-- 1) Align created_at types (only if currently timestamptz)
-- If your columns are already timestamp without time zone, these will no-op.
ALTER TABLE public.referrals
  ALTER COLUMN created_at TYPE timestamp
  USING created_at::timestamp;

ALTER TABLE public.referral_usages
  ALTER COLUMN created_at TYPE timestamp
  USING created_at::timestamp;

-- 2) Drop the problematic FK to auth.users on referrals.user_id (if present)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'referrals'
      AND c.conname = 'referrals_user_id_fkey'
  ) THEN
    ALTER TABLE public.referrals DROP CONSTRAINT referrals_user_id_fkey;
  END IF;
END $$;

-- 3) (Optional) Drop FK on referral_usages.referred_user_id too, to prevent same issue
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'referral_usages'
      AND c.conname = 'referral_usages_referred_user_id_fkey'
  ) THEN
    ALTER TABLE public.referral_usages DROP CONSTRAINT referral_usages_referred_user_id_fkey;
  END IF;
END $$;

-- 4) Recreate RPCs so they only operate on auth.uid()
DROP FUNCTION IF EXISTS public.get_user_referral_code(uuid);
CREATE OR REPLACE FUNCTION public.get_user_referral_code(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid;
  v_existing_code text;
  v_new_code text;
  v_chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  v_attempts integer := 0;
  v_max_attempts integer := 100;
BEGIN
  v_uid := auth.uid();

  -- Only allow fetching/creating for the currently authenticated user
  IF v_uid IS NULL OR p_user_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT r.referral_code
    INTO v_existing_code
  FROM public.referrals r
  WHERE r.user_id = v_uid;

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
      SELECT 1 FROM public.referrals r2 WHERE r2.referral_code = v_new_code
    ) THEN
      INSERT INTO public.referrals (user_id, referral_code)
      VALUES (v_uid, v_new_code);

      RETURN v_new_code;
    END IF;

    IF v_attempts >= v_max_attempts THEN
      RAISE EXCEPTION 'Could not generate unique referral code after % attempts', v_max_attempts;
    END IF;
  END LOOP;
END;
$$;

-- Keep generate_referral_code as wrapper for compatibility
DROP FUNCTION IF EXISTS public.generate_referral_code(uuid);
CREATE OR REPLACE FUNCTION public.generate_referral_code(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN public.get_user_referral_code(p_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_referral_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_referral_code(uuid) TO authenticated;

COMMIT;
