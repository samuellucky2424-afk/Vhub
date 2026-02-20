-- ============================================================
-- REFERRAL SYSTEM DATABASE STRUCTURE IMPLEMENTATION
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1️⃣ CREATE REFERRALS TABLE
-- Stores unique referral codes for each user
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code varchar(5) NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2️⃣ CREATE REFERRAL_USAGES TABLE  
-- Tracks who used which referral codes
CREATE TABLE IF NOT EXISTS public.referral_usages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  referral_code varchar(5) NOT NULL REFERENCES public.referrals(referral_code) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_credited boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3️⃣ ENSURE ONE USER = ONE REFERRAL CODE
-- Add unique constraint to prevent duplicate referral codes per user
ALTER TABLE public.referrals 
ADD CONSTRAINT referrals_user_id_unique UNIQUE (user_id);

-- 4️⃣ ENABLE ROW LEVEL SECURITY (RLS)
-- Enable RLS on both tables for security
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_usages ENABLE ROW LEVEL SECURITY;

-- 5️⃣ CREATE RLS POLICIES FOR REFERRALS TABLE
-- Users can view their own referral code
DROP POLICY IF EXISTS "Users can view own referral" ON public.referrals;
CREATE POLICY "Users can view own referral"
  ON public.referrals
  FOR SELECT
  USING (auth.uid() = user_id);

-- Anyone can look up referral codes (needed for validation during signup)
DROP POLICY IF EXISTS "Anyone can look up referral codes" ON public.referrals;
CREATE POLICY "Anyone can look up referral codes"
  ON public.referrals
  FOR SELECT
  USING (true);

-- Users can insert their own referral code (handled by RPC function)
DROP POLICY IF EXISTS "Users can insert own referral" ON public.referrals;
CREATE POLICY "Users can insert own referral"
  ON public.referrals
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 6️⃣ CREATE RLS POLICIES FOR REFERRAL_USAGES TABLE
-- Users can view usages of their own referral codes
DROP POLICY IF EXISTS "Users can view own referral usages" ON public.referral_usages;
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

-- Referred users can view their own usage entry
DROP POLICY IF EXISTS "Referred users can view own usage" ON public.referral_usages;
CREATE POLICY "Referred users can view own usage"
  ON public.referral_usages
  FOR SELECT
  USING (referred_user_id = auth.uid());

-- System can insert referral usages (handled by RPC function)
DROP POLICY IF EXISTS "System can insert referral usages" ON public.referral_usages;
CREATE POLICY "System can insert referral usages"
  ON public.referral_usages
  FOR INSERT
  WITH CHECK (true);

-- 7️⃣ ENABLE REALTIME FOR REFERRAL TABLES
-- Allow realtime subscriptions for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.referrals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.referral_usages;

-- 8️⃣ CREATE INDEXES FOR PERFORMANCE
-- Speed up referral code lookups
CREATE INDEX IF NOT EXISTS idx_referrals_referral_code ON public.referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_user_id ON public.referrals(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_usages_referral_code ON public.referral_usages(referral_code);
CREATE INDEX IF NOT EXISTS idx_referral_usages_referred_user_id ON public.referral_usages(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_usages_reward_credited ON public.referral_usages(reward_credited);

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Verify referrals table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE 
    table_schema = 'public' 
    AND table_name = 'referrals'
ORDER BY ordinal_position;

-- Verify referral_usages table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE 
    table_schema = 'public' 
    AND table_name = 'referral_usages'
ORDER BY ordinal_position;

-- Verify constraints exist
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE 
    tc.table_schema = 'public'
    AND tc.table_name IN ('referrals', 'referral_usages')
    AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE', 'FOREIGN KEY')
ORDER BY tc.table_name, tc.constraint_type;

-- Verify RLS policies are active
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    with_check
FROM pg_policies 
WHERE 
    schemaname = 'public' 
    AND tablename IN ('referrals', 'referral_usages')
ORDER BY tablename, policyname;

-- Test referral code generation (will be handled by RPC functions)
SELECT 
    'referrals' as table_name,
    COUNT(*) as row_count
FROM public.referrals;

SELECT 
    'referral_usages' as table_name,
    COUNT(*) as row_count
FROM public.referral_usages;

-- ============================================================
-- MIGRATION NOTES
-- ============================================================

-- ✅ Tables created with proper structure
-- ✅ One user = one referral code (unique constraint)
-- ✅ Foreign key relationships established
-- ✅ RLS policies implemented for security
-- ✅ Realtime enabled for live updates
-- ✅ Performance indexes created
-- ✅ No existing data modified or dropped

-- ============================================================
-- NEXT STEPS
-- ============================================================

-- 1. Run the RPC function creation scripts:
--    - create_missing_referral_functions.sql
--    - create_referral_system.sql (if not already run)

-- 2. Test the referral system:
--    - Generate referral codes for existing users
--    - Test referral code validation
--    - Verify realtime updates work

-- ============================================================
-- DONE!
-- ============================================================
