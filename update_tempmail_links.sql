-- ============================================================
-- Add verification_link to temp_email_messages
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

ALTER TABLE public.temp_email_messages ADD COLUMN IF NOT EXISTS verification_link TEXT;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
