UPDATE public.orders
SET status = 'refunded'
WHERE status IN ('processing', 'pending')
  AND payment_status IN ('paid', 'pending')
  AND payment_status != 'refunded'
  AND created_at < now() - interval '3 minutes';
