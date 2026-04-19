-- ============================================================
-- FIX EMPTY PROFILES TABLE + AUTO-CREATE ON SIGNUP
-- Problem: public.profiles is empty, so referral names show as Anonymous.
-- Solution:
--   1) Backfill existing users from auth.users into public.profiles
--   2) Add trigger to auto-create profile rows on new user signup
-- ============================================================

-- 1) Backfill existing users (safe, idempotent)
insert into public.profiles (id, email, full_name, role, created_at)
select
  u.id,
  u.email,
  coalesce(
    u.raw_user_meta_data->>'full_name',
    split_part(u.email, '@', 1)
  ) as full_name,
  'user' as role,
  u.created_at::timestamp as created_at
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- 2) Create function to handle new user profile creation
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, email, full_name, role, created_at)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1)
    ),
    'user',
    now()::timestamp
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name;
  return new;
end;
$$;

-- 3) Create trigger (drop if exists first)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- 4) Verify profiles are populated
select count(*) as total_profiles from public.profiles;

-- ============================================================
-- DONE!
-- ============================================================
-- After running this:
-- - Existing users will have profile rows
-- - New signups will auto-create profile rows
-- - Referral names will show up (once you also run add_referred_name_to_get_user_referrals.sql)
