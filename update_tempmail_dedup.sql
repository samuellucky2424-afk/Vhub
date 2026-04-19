-- ============================================================
-- ADD gmail_message_id FOR EMAIL DEDUPLICATION
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- Add a column to store the intrinsic Gmail ID
ALTER TABLE public.temp_email_messages ADD COLUMN IF NOT EXISTS gmail_message_id TEXT;

-- Create a unique constraint to prevent duplicates absolutely at the DB layer
-- (If there are existing duplicates, it will fail to apply, which is fine for now,
-- but we only care about new inserts being safe)
ALTER TABLE public.temp_email_messages ADD CONSTRAINT unique_gmail_message_id UNIQUE (gmail_message_id);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
