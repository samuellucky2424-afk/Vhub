-- Create Wallets Table
CREATE TABLE IF NOT EXISTS public.wallets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL UNIQUE,
  balance numeric DEFAULT 0 CHECK (balance >= 0),
  currency text DEFAULT 'NGN',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Wallets
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own wallet" ON public.wallets;
CREATE POLICY "Users can view own wallet"
  ON public.wallets FOR SELECT
  USING (auth.uid() = user_id);

-- Create Wallet Transactions Table
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_id uuid REFERENCES public.wallets(id) NOT NULL,
  amount numeric NOT NULL,
  type text NOT NULL CHECK (type IN ('deposit', 'purchase', 'refund', 'adjustment')),
  reference text, -- Order ID or Payment Reference
  description text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Transactions
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own transactions" ON public.wallet_transactions;
CREATE POLICY "Users can view own transactions"
  ON public.wallet_transactions FOR SELECT
  USING (auth.uid() = (SELECT user_id FROM public.wallets WHERE id = wallet_transactions.wallet_id));

-- Update Orders table verification (Modify check constraint if strictly needed, or just rely on text)
-- Supabase text columns with check constraints need to be dropped and recreated to change valid values
-- or we can drop the constraint.
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check 
  CHECK (payment_status IN ('pending', 'paid', 'failed', 'completed', 'refunded', 'cancelled'));
