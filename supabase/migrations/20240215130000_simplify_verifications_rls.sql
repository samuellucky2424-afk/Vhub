
-- Simplify RLS policy for verifications to use direct user_id check
-- This avoids Join issues and improves performance
-- Also fixes potential 403s if join logic fails or order permissions conflict

drop policy if exists "Users can view own verifications" on public.verifications;

create policy "Users can view own verifications"
  on public.verifications for select
  using (auth.uid() = user_id);
