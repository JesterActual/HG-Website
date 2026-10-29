-- REVIEW ONLY — NOT YET APPLIED.
-- Hostile Ground DEV identity foundation. Convert into a tracked Supabase migration
-- with the Supabase CLI when available; review and apply to DEV only.
-- Prerequisites: fresh isolated HostileGround-DEV project, email confirmations on,
-- signups disabled, and mandatory AAL2 requirement on all protected endpoints.
begin;

-- Internal administrative grants are never made available to browser roles.
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

create table if not exists public.member_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text null check (display_name is null or char_length(display_name) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.member_profiles enable row level security;
revoke all on public.member_profiles from public, anon, authenticated;

-- Restricted column grants. Members may not edit ownership or timestamps.
grant select on public.member_profiles to authenticated;
grant insert (user_id, display_name) on public.member_profiles to authenticated;
grant update (display_name) on public.member_profiles to authenticated;

-- Allow only a fully MFA-verified member to see their own profile.
create policy member_profiles_select_self_aal2
  on public.member_profiles for select to authenticated
  using (
    (select auth.uid()) = user_id
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

create policy member_profiles_insert_self_aal2
  on public.member_profiles for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

create policy member_profiles_update_self_aal2
  on public.member_profiles for update to authenticated
  using (
    (select auth.uid()) = user_id
    and (select auth.jwt() ->> 'aal') = 'aal2'
  )
  with check (
    (select auth.uid()) = user_id
    and (select auth.jwt() ->> 'aal') = 'aal2'
  );

-- The baseline 'member' privilege is implied for verified members.
-- Explicit role grants below represent elevated administrative privileges only.
create table if not exists app_private.member_role_grants (
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('instructor', 'academy_admin', 'site_admin')),
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);
create index if not exists member_role_grants_role_idx
  on app_private.member_role_grants (role);

alter table app_private.member_role_grants enable row level security;
revoke all on app_private.member_role_grants from public, anon, authenticated;

-- No RLS policies are defined for app_private grants: deny by default.
-- A future audited backend operation will handle role management.
commit;
