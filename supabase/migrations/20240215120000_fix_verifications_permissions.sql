-- Grant permissions to service_role just in case it's not inherited
GRANT ALL ON TABLE public.verifications TO service_role;

-- Explicit policy for service_role to bypass RLS (redundant usually but fixes some edge cases)
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'verifications' and policyname = 'Service Role Full Access') then
    CREATE POLICY "Service Role Full Access" ON public.verifications
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  end if;
end $$;
