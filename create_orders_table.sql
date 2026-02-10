-- Complete Orders Table Setup
-- Run this in Supabase Dashboard → SQL Editor

-- Drop existing table if it exists (WARNING: This will delete all data!)
-- Comment out the next line if you want to preserve existing data
DROP TABLE IF EXISTS public.orders CASCADE;

-- Create the orders table with all required columns
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  payment_reference text UNIQUE NOT NULL,
  payment_status text CHECK (payment_status IN ('pending', 'paid', 'failed')) DEFAULT 'pending',
  service_type text NOT NULL,
  price_usd numeric NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  request_id text, -- SMSPool request ID
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can insert own orders" ON public.orders;

-- Policy: Users can see only their own orders
CREATE POLICY "Users can view own orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own orders (for initial creation)
CREATE POLICY "Users can insert own orders"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Verify the table was created correctly
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'orders'
ORDER BY ordinal_position;
