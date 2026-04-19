-- Fix orders constraint - run in Supabase SQL Editor
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
CHECK (status IN ('pending', 'processing', 'number_received', 'waiting_sms', 'completed', 'refunded', 'cancelled', 'failed'));
SELECT 'Fixed' as result;
