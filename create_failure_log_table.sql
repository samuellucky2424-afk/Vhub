-- =============================================================
-- failure_logs — Monitoring table for debugging
--
-- Logs all edge function failures, refund issues, and
-- transaction anomalies for investigation.
--
-- Run this in Supabase SQL Editor.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.failure_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,              -- e.g. 'purchase_wallet', 'refund', 'reconcile'
  error_message text,
  context jsonb DEFAULT '{}'::jsonb, -- arbitrary debug data
  resolved boolean DEFAULT false,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.failure_logs ENABLE ROW LEVEL SECURITY;

-- Only service_role can read/write (admin-only table)
GRANT ALL ON TABLE public.failure_logs TO service_role;

-- Helper function to insert a failure log from edge functions
CREATE OR REPLACE FUNCTION log_failure(
  p_user_id uuid,
  p_action text,
  p_error_message text,
  p_context jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO public.failure_logs (user_id, action, error_message, context)
  VALUES (p_user_id, p_action, p_error_message, p_context)
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- Verify
SELECT 'failure_logs table and log_failure function created successfully' AS result;
