-- ============================================================
-- ADD referred_name TO get_user_referrals()
-- Uses public.profiles.full_name (NOT auth.users) as requested.
-- Keeps RLS intact: function is SECURITY DEFINER.
-- ============================================================

-- Make sure profiles table exists (you confirmed it does)

DROP FUNCTION IF EXISTS public.get_user_referrals(uuid);

CREATE OR REPLACE FUNCTION public.get_user_referrals(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  referral_code varchar,
  referred_user_id uuid,
  referred_name text,
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
    COALESCE(p.full_name, 'Anonymous') AS referred_name,
    ru.reward_credited,
    ru.created_at
  FROM public.referral_usages ru
  JOIN public.referrals r
    ON r.referral_code = ru.referral_code
  LEFT JOIN public.profiles p
    ON p.id = ru.referred_user_id
  WHERE r.user_id = p_user_id
  ORDER BY ru.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_referrals(uuid) TO authenticated;
