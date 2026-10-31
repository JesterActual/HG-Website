-- Step 50d / HostileGround-DEV ONLY — REVIEW BEFORE EXECUTION
-- Deliberately not applied by this PR. Apply only after approved checkpoint.
-- Existing public.member_profiles owner- and AAL2-scoped RLS policies are retained.
begin;
grant usage on schema public to authenticated;
grant select (user_id, display_name) on table public.member_profiles to authenticated;
grant insert (user_id, display_name) on table public.member_profiles to authenticated;
grant update (display_name) on table public.member_profiles to authenticated;
-- Do not grant DELETE, UPDATE(user_id), or access to anon.
create or replace function public.set_member_profile_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.set_member_profile_updated_at() from public, anon, authenticated;
create trigger member_profiles_update_timestamp
before update on public.member_profiles
for each row execute function public.set_member_profile_updated_at();
commit;

-- Expected verification in DEV after approval:
-- 1. authenticated privileges: SELECT, INSERT(user_id, display_name), UPDATE(display_name), no DELETE.
-- 2. Existing RLS INSERT/SELECT/UPDATE remain restricted by auth.uid() and JWT aal2.
-- 3. Anonymous and password-only (aal1) cannot read/insert/update.
-- 4. Member with aal2 can create and edit own profile, not another user's.
-- 5. Attempt to edit user_id denied. updated_at changes on update.
-- 6. This review script is not executed automatically in Cloudflare.
