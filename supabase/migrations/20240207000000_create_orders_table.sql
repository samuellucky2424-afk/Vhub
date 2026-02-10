-- Create the orders table
create table if not exists public.orders (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  payment_reference text unique not null,
  payment_status text check (payment_status in ('pending', 'paid', 'failed')) default 'pending',
  service_type text not null,
  price_usd numeric not null,
  metadata jsonb default '{}'::jsonb,
  request_id text, -- SMSPool request ID
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Establish Row Level Security (RLS)
alter table public.orders enable row level security;

-- Policy: Users can see only their own orders
create policy "Users can view own orders"
  on public.orders for select
  using (auth.uid() = user_id);

-- Policy: Users can insert their own orders (for initial creation)
create policy "Users can insert own orders"
  on public.orders for insert
  with check (auth.uid() = user_id);

-- Policy: Service Role can do everything (for webhooks)
-- Note: Service role bypasses RLS by default, but good to be explicit if needed or for testing with non-service role admins.
-- Implicitly allowed for service_role.
