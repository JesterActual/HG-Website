# Step 50d — Member identity and authorization: DEV schema audit and implementation gates

Status: **Review only. No database change in this pull request.** Scope: HostileGround-DEV (`msyfebqblforuvohwxpr`) and branch `dev`; never target `main`.

## Verified baseline (2026-10-30)

- Supabase migration history includes `20261029010339_create_member_identity_foundation`.
- `public.member_profiles` is present, with `user_id` (uuid primary key, FK to auth.users), `display_name` (nullable, <=80 chars), `created_at`, `updated_at`. RLS is enabled.
- Its SELECT, INSERT, UPDATE policies are owner-scoped (`auth.uid() = user_id`) and require JWT assurance `aal2`; UPDATE includes both USING and WITH CHECK. There is no DELETE policy.
- Actual table privilege audit shows `authenticated` has SELECT but **not INSERT or UPDATE**. The existence of RLS policies does not grant SQL privileges. The current frontend reads a missing profile successfully; creation will not succeed until a narrowly scoped grant is added.
- `app_private.member_role_grants` exists, has RLS enabled and no RLS policies, and has no grants to `authenticated` or `anon`. This is an intentional deny-by-default private authorization source, **not** a public access bug. Constraints restrict grants to `instructor`, `academy_admin`, and `site_admin`; ordinary `member` is implicit.
- No routines exist yet for auditing or administering roles.
- Supabase security advisor currently reports: `auth_leaked_password_protection` disabled (warning) and private role table without RLS policies (informational, intentionally private).

## Design and rollout gates

1. **Profile operations (separate approved DEV change)**: grant only necessary `INSERT` and `UPDATE` to `authenticated` on `public.member_profiles`, with the existing AAL2 owner-scoped RLS policies retained. Re-test anonymous, AAL1, AAL2-own, AAL2-other access. No public grants, no service key in browser code.
2. **Role assignments (separate approved DEV change)**: retain private table inaccessible to regular accounts; define explicit audited administration via a narrowly scoped trusted server function or transaction. Check both current MFA assurance and a fresh, server-authoritative admin grant on *every* privileged action. Do not use user-editable profile fields or user_metadata as authority. Do not promote the first site admin through a public self-service route; use an explicitly approved bootstrap procedure.
3. **Role test matrix**: default member (no role grant), instructor, academy_admin, site_admin; revoked grants, unauthenticated, AAL1, AAL2, cross-user requests, inappropriate role edits and stale JWT. A database role grant is not the same thing as an elevated member authorization.
4. **Training Academy remains separate**: class enrollment/rosters/waitlists/attendance, session-scoped instructors and concurrency protections are later steps. No training registration is opened by this work.
5. **Security advisory**: review leaked-password protection availability in the DEV Authentication settings and enable when supported; never weaken security merely to silence an advisory.

## Operational controls

- No production data in DEV; keep DEV and PROD Supabase projects and Cloudflare environments separate.
- Release database changes in separately reviewed steps with an SQL migration committed to source control and a validated rollback approach; compare actual database schema and migration history.
- Keep public signups and account recovery disabled until explicitly approved.
- Verify the actual backend and database RLS enforcement, not just hidden UI controls.
- Use Supabase Auth for identity and TOTP. Never add secret/service-role credentials to public assets, logs, or GitHub.
- Do not change LOCKBOX operation schedule or production site.
