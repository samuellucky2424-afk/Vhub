-- ============================================================
-- TEMP EMAIL SYSTEM — DATABASE MIGRATION (FIXED)
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Drop old temp_emails table if it has wrong schema
DROP TABLE IF EXISTS public.temp_email_messages CASCADE;
DROP TABLE IF EXISTS public.temp_emails CASCADE;

-- 2. Create temp_emails table (master email records)
CREATE TABLE public.temp_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  email_address TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes')
);

-- 3. Create temp_email_messages table
CREATE TABLE public.temp_email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID NOT NULL REFERENCES public.temp_emails(id) ON DELETE CASCADE,
  sender TEXT,
  subject TEXT,
  body TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Indexes
CREATE INDEX idx_temp_emails_user_id ON public.temp_emails(user_id);
CREATE INDEX idx_temp_emails_email_address ON public.temp_emails(email_address);
CREATE INDEX idx_temp_emails_status ON public.temp_emails(status);
CREATE INDEX idx_temp_email_messages_email_id ON public.temp_email_messages(email_id);

-- 5. Enable RLS
ALTER TABLE public.temp_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.temp_email_messages ENABLE ROW LEVEL SECURITY;

-- 6. RLS policies
CREATE POLICY temp_emails_select_own ON public.temp_emails FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY temp_email_messages_select_own ON public.temp_email_messages FOR SELECT
  USING (email_id IN (SELECT id FROM public.temp_emails WHERE user_id = auth.uid()));

-- 7. Grant permissions
GRANT ALL ON public.temp_emails TO service_role;
GRANT ALL ON public.temp_email_messages TO service_role;
GRANT SELECT ON public.temp_emails TO authenticated;
GRANT SELECT ON public.temp_email_messages TO authenticated;

-- 8. Existing table grants
GRANT ALL ON public.temp_email_orders TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.temp_email_orders TO authenticated;
GRANT SELECT, UPDATE ON public.wallets TO service_role;
GRANT SELECT, INSERT ON public.wallet_transactions TO service_role;

-- 9. Add to realtime
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.temp_emails;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.temp_email_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
