-- Create the verifications table
create table if not exists public.verifications (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders(id) not null,
  otp_code text not null,
  full_sms text,
  received_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.verifications enable row level security;

-- Policy: Users can view their own verifications (via order ownership)
-- Policy: Users can view their own verifications (via order ownership)
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'verifications' and policyname = 'Users can view own verifications') then
    create policy "Users can view own verifications"
      on public.verifications for select
      using (
        exists (
          select 1 from public.orders
          where public.orders.id = public.verifications.order_id
          and public.orders.user_id = auth.uid()
        )
      );
  end if;
end $$;

-- Policy: Service role can insert verifications
-- Implicitly allowed for service_role, but explicit policy sometimes helps clarity
-- or if strict policies are enabled. For now service_role bypasses RLS.
