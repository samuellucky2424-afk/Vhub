-- =============================================================
-- CLEANUP: Mark orphaned orders as 'failed'
--
-- These are orders that have payment_status='pending' but no
-- request_id, meaning the SMSPool purchase was never initiated.
-- They will never transition to any other state.
--
-- Run this in Supabase SQL Editor AFTER fix_status_constraint.sql
-- =============================================================

-- Preview: See which orders will be affected
SELECT id, payment_status, request_id, service_type, created_at
FROM public.orders
WHERE payment_status = 'pending'
  AND (request_id IS NULL OR request_id = '')
ORDER BY created_at DESC;

-- Execute: Mark them as failed (comment out the SELECT above first)
-- UPDATE public.orders
-- SET payment_status = 'failed',
--     metadata = COALESCE(metadata, '{}'::jsonb) || '{"cleanup_reason": "no_smspool_request_id", "cleaned_at": "' || NOW()::text || '"}'::jsonb
-- WHERE payment_status = 'pending'
--   AND (request_id IS NULL OR request_id = '');
