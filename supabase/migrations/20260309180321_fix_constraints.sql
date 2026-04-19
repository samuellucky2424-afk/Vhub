ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS order_status_check;
ALTER TABLE public.orders ADD CONSTRAINT order_status_check
  CHECK (status IN ('pending', 'processing', 'active', 'completed', 'refunded', 'expired'));
