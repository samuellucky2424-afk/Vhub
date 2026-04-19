-- Drop constraint and allow NULL temporarily, then fix
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ALTER COLUMN status DROP NOT NULL;
UPDATE public.orders SET status = 'processing' WHERE status IS NULL OR status NOT IN ('pending', 'processing', 'number_received', 'waiting_sms', 'completed', 'refunded', 'cancelled', 'failed');
ALTER TABLE public.orders ALTER COLUMN status SET NOT NULL;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (status IN ('pending', 'processing', 'number_received', 'waiting_sms', 'completed', 'refunded', 'cancelled', 'failed'));
SELECT 'Fixed' as result;
