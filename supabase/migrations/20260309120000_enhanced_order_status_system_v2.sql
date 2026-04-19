-- =============================================================
-- Enhanced Order Status System - Fix existing constraint issue
-- Run this in Supabase Dashboard → SQL Editor
-- =============================================================

-- 1. First, find and drop the existing constraint that's blocking us
DO $$
DECLARE
  cons_name text;
BEGIN
  -- Find the constraint on orders.status
  SELECT conname INTO cons_name
  FROM pg_constraint
  WHERE conrelid = 'public.orders'::regclass
    AND contype = 'c'
    AND conname LIKE '%status%';
  
  IF cons_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS ' || cons_name;
    RAISE NOTICE 'Dropped constraint: %', cons_name;
  END IF;
END $$;

-- 2. Update any non-standard statuses to valid ones
UPDATE public.orders SET status = 'processing' WHERE status IS NULL OR status NOT IN ('pending', 'processing', 'number_received', 'waiting_sms', 'completed', 'refunded', 'cancelled', 'failed');

-- 3. Add the new check constraint
ALTER TABLE public.orders 
ADD CONSTRAINT orders_status_check 
CHECK (status IN (
  'pending', 'processing', 'number_received', 'waiting_sms', 
  'completed', 'refunded', 'cancelled', 'failed'
));

-- 4. Add missing columns if they don't exist
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS started_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS timeout_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_polled_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS poll_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0;

-- 5. Add indexes for efficient polling
CREATE INDEX IF NOT EXISTS idx_orders_status_poll ON public.orders(status) 
WHERE status IN ('processing', 'number_received', 'waiting_sms');

CREATE INDEX IF NOT EXISTS idx_orders_timeout_at ON public.orders(timeout_at) 
WHERE status IN ('processing', 'number_received', 'waiting_sms');

CREATE INDEX IF NOT EXISTS idx_orders_request_id ON public.orders(request_id) 
WHERE request_id IS NOT NULL;

-- 6. Create order_status_logs table
CREATE TABLE IF NOT EXISTS public.order_status_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  previous_status text,
  new_status text NOT NULL,
  smspool_status integer,
  smspool_message text,
  sms_code text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.order_status_logs ENABLE ROW LEVEL SECURITY;

-- 7. Create helper functions
CREATE OR REPLACE FUNCTION log_order_status_change(
  p_order_id uuid,
  p_previous_status text,
  p_new_status text,
  p_smspool_status integer DEFAULT NULL,
  p_smspool_message text DEFAULT NULL,
  p_sms_code text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.order_status_logs (order_id, previous_status, new_status, smspool_status, smspool_message, sms_code, metadata)
  VALUES (p_order_id, p_previous_status, p_new_status, p_smspool_status, p_smspool_message, p_sms_code, p_metadata);
END;
$$;

CREATE OR REPLACE FUNCTION get_orders_needing_poll(p_limit int DEFAULT 50)
RETURNS TABLE(id uuid, user_id uuid, status text, request_id text, phone_number text, timeout_at timestamp with time zone, poll_count int, created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT o.id, o.user_id, o.status, o.request_id, o.phone_number, o.timeout_at, o.poll_count, o.created_at
  FROM public.orders o
  WHERE o.status IN ('processing', 'number_received', 'waiting_sms')
    AND (o.timeout_at IS NULL OR o.timeout_at > now())
  ORDER BY CASE o.status WHEN 'processing' THEN 1 WHEN 'number_received' THEN 2 WHEN 'waiting_sms' THEN 3 END, o.created_at ASC
  LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION get_timed_out_orders(p_limit int DEFAULT 50)
RETURNS TABLE(id uuid, user_id uuid, status text, request_id text, phone_number text, price_kobo bigint, created_at timestamp with time zone, timeout_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT o.id, o.user_id, o.status, o.request_id, o.phone_number, o.price_kobo, o.created_at, o.timeout_at
  FROM public.orders o
  WHERE o.status IN ('processing', 'number_received', 'waiting_sms')
    AND o.timeout_at IS NOT NULL AND o.timeout_at < now()
  ORDER BY o.timeout_at ASC
  LIMIT p_limit;
END;
$$;

SELECT 'Enhanced order status system v2 applied successfully' AS result;
