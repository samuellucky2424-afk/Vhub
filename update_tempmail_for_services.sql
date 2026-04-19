-- ============================================================
-- TEMP EMAIL SYSTEM — SERVICE & OTP UPGRADE
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Add "service" column to temp_emails
ALTER TABLE public.temp_emails ADD COLUMN IF NOT EXISTS service TEXT DEFAULT 'Default';

-- 2. Add "otp_code" column to temp_email_messages
ALTER TABLE public.temp_email_messages ADD COLUMN IF NOT EXISTS otp_code TEXT;

-- 3. Update existing rows (optional, just to be safe)
UPDATE public.temp_emails SET service = 'Default' WHERE service IS NULL;

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
