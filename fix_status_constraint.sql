-- =============================================================
-- FIX: Update orders.payment_status CHECK constraint
-- to allow 'completed' and 'refunded' values from SMSPool sync
--
-- Run this in Supabase SQL Editor
-- =============================================================

-- 1. Drop the existing constraint that blocks our status updates
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;

-- 2. Recreate with all valid statuses
-- SMSPool statuses: pending, completed, refunded
-- Internal statuses: paid, failed, cancelled, manual_intervention_required
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check 
  CHECK (payment_status IN ('pending', 'paid', 'completed', 'refunded', 'failed', 'cancelled', 'manual_intervention_required'));
