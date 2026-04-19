-- Create temp_email_orders table
create table if not exists public.temp_email_orders (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  email text not null,
  order_status text not null check (order_status in ('waiting', 'received', 'expired')) default 'waiting',
  otp_code text,
  email_body text,
  service text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists temp_email_orders_user_id_idx on public.temp_email_orders(user_id);
create index if not exists temp_email_orders_email_idx on public.temp_email_orders(email);
create index if not exists temp_email_orders_order_status_idx on public.temp_email_orders(order_status);

alter table public.temp_email_orders enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'temp_email_orders'
      and policyname = 'Users can view own temp email orders'
  ) then
    create policy "Users can view own temp email orders"
      on public.temp_email_orders for select
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'temp_email_orders'
      and policyname = 'Users can insert own temp email orders'
  ) then
    create policy "Users can insert own temp email orders"
      on public.temp_email_orders for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'temp_email_orders'
      and policyname = 'Users can update own temp email orders'
  ) then
    create policy "Users can update own temp email orders"
      on public.temp_email_orders for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
