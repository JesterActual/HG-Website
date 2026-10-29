# Member identity schema — development review only

This change targets GitHub `dev` and does **not** apply SQL or create accounts. The SQL is in `database/member-identity.review.sql`. It is intentionally **not** a Supabase CLI migration yet because the CLI must generate the actual timestamped migration filename during the approved application step.

## Scope
- Member profile referenced by Supabase `auth.users`, with optional display name.
- AAL2 row-level security policies restricting profiles to their own account.
- Column-scoped grants prevent editing ownership or timestamps.
- Internal-only, deny-by-default instructor/admin role grants; no role escalation exposed to browser users.
- No insert trigger, so no personal member data is generated before MFA succeeds.

## Gates before applying to HostileGround-DEV
1. Review schema/role model, verify no existing conflicting tables.
2. Generate tracked migration using the current Supabase CLI (`supabase migration new <name>`), copy reviewed SQL into that file, and apply only to the isolated development project.
3. Run Supabase security advisors and inspect SQL grants/RLS.
4. Test using synthetic users with anonymous, AAL1 and AAL2 sessions. Assert all protected operations fail for anonymous/AAL1.
5. Verify AAL2 user can read, insert and update **only their own** profile, but cannot change `user_id`, timestamps, or access another profile.
6. Verify browser role cannot access or mutate `app_private.member_role_grants`; an administrator using a trusted backend must never accept a client-provided role unchecked.
7. Confirm public signups remain disabled and `main` has no changes.

## Remaining work
- Configure full verified-email and TOTP authentication/callback flows on dev, with a server-side verified-email check before protected requests.
- Design account recovery, session invalidation, MFA factor removal, and anti-abuse controls.
- Implement a trusted, audited admin role-grant service and proper instructor/Academy role scoping.
- Introduce training classes and registration schema separately after review.
- No production backend, account creation page, or public enrollment until security testing is complete.

## Cautions
RLS is an additional defense: the server API must independently validate fresh sessions, verified email, MFA assurance, and current administrative role grants. Never expose a Supabase secret/service-role key in Pages HTML, JS, GitHub, or preview builds.
