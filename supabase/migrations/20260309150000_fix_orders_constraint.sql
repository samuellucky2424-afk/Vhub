-- Fix orders_status_check constraint
-- Run in Supabase SQL Editor

-- 1. Drop existing constraint
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- 2. Update any invalid statuses to valid ones
UPDATE public.orders SET status = 'processing' WHERE status IS NULL OR status NOT IN ('pending', 'processing', 'number_received', 'waiting_sms', 'completed', 'refunded', 'cancelled', 'failed');

-- 3. Add new constraint with all valid statuses
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
CHECK (status IN ('pending', 'processing', 'number_received', 'waiting_sms', 'completed', 'refunded', 'cancelled', 'failed'));

-- 4. Verify
SELECT DISTINCT status, COUNT(*) as cnt FROM public.orders GROUP BY status;
