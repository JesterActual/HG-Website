# Hostile Ground Member Portal — Step 49 security architecture

Status: Approved design only; **no authentication, signup, database, or secured pages deployed**.

## Design
Continue the public static site on Cloudflare Pages. Add an authenticated API through Cloudflare Pages Functions (subject to actual deployment verification), Supabase Auth for identities/email verification/TOTP MFA, and a separate Supabase PostgreSQL database with deny-first row-level security (RLS). The member account is shared across the Training Academy and all future protected site sections. Discord is optional communications, not the enrollment system.

## Hard security invariants
1. Email verified and TOTP authenticator enrolled and **successfully challenged** before protected access. Both server endpoints and database policies must require AAL2; enrollment alone is not enforcement. Anonymous, unverified and AAL1 users cannot read protected data.
2. Authorization is distinct from authentication. Roles are granted only by trusted administrative operations, checked server-side for every request and enforced via RLS. Never trust a user-editable profile role.
3. Default role member; separate instructor (assigned classes only), academy_admin (Academy only), and site_admin (site roles/security). Audit changes. Re-check up-to-date role grants for privileged operations.
4. Prevent horizontal access: members read/edit own records only. Instructors see only assigned rosters; no exposure of other class or member information.
5. No privileged Supabase service key in browser assets, repository, build output or logs. Public anon key is not itself secret but cannot replace RLS. Provider credentials and auth secrets held only in environment-specific secrets.
6. HTTPS, secure HttpOnly SameSite cookies for chosen cookie-based auth, CSRF defenses, controlled redirects and origins, session expiration/revocation, rate limits, anti-automation, password reset and careful MFA recovery policies.
7. Do not build homemade password/MFA cryptography. Recovery and helpdesk resets need independently verified identity, explicit controls and audit trails; never allow email alone to bypass mandatory MFA.
8. Minimize personal information; publish privacy/retention policy and address guardians/minors before enrollment, establish backup/restore and incident response.
9. No sensitive personal production data copied into development. Development and production Supabase projects, users, keys, callback allowlists, deploy bindings and databases must be **entirely separate**. Preview sites may be public: restrict dev test access and use synthetic identities.
10. Private records must never be embedded into static HTML or bundled JS. Protection must be server-side, not merely hidden links/buttons.

## Proposed data model (not migrated)
- `member_profiles(user_id uuid PK references auth.users, display_name, created_at, updated_at)`.
- `member_role_grants(user_id, role, granted_by, granted_at)`, roles: member/instructor/academy_admin/site_admin.
- `courses(id, level, name, description, prerequisites, status)`.
- `training_sessions(id, course_id, begins_at, ends_at, timezone, location, capacity, status)`.
- `enrollments(id, member_id, session_id, state, timestamps)` with unique member/session, states requested/confirmed/waitlisted/cancelled/completed/no_show.
- `session_instructors(session_id, instructor_id)`.
- `attendance_records(enrollment_id, recorded_by, outcome, timestamp)`.
- `security_audit_events(actor_id, action, target, result, timestamp)`. No secrets or tokens stored.

All tables require constraints and explicit RLS policies; privileged roster and capacity updates through audited server-side transactions that prevent overbooking under concurrent requests. This is only a conceptual contract: no implementation migration yet.

## Separation and release controls
DEV: own Supabase project, Auth settings, isolated test database, isolated Cloudflare preview/dev origin and bindings, synthetic members, dev callback allowlist and test email. PROD: separate project, identities, database, keys and production callback allowlist. Test migrations in dev first; review, backup and apply to prod in a separate approved step. Never point previews at production privileged APIs/keys.

## Required test matrix
Anonymous/unverified/AAL1/AAL2; all member roles; MFA enrollment vs challenge; logout, expired/revoked tokens, recovery; direct API access and RLS bypass attempts; cross-user record access, instructor scope, unauthorized role edits; CSRF/CORS; concurrent final-seat enrollment, duplicate signups, cancellation/waitlisting; accidental exposure of secrets in previews/logs; database backup/restore.

## Planned increments
Step 49: this architecture and security requirements only. Step 50a: user-authorized DEV Supabase/Cloudflare service setup and secret configuration. Step 50b: schema + automated RLS tests on dev. Step 50c: email verification, sign-up, mandatory MFA and recovery on dev. Step 51: Academy courses, registrations, waitlists, instructor rosters. Step 52: audit, isolated production provisioning, staged launch.

## Outstanding pre-launch decisions
Protected/development hostnames; exact recovery and emergency administrator policy; course price/payment policy; minor/guardian and waiver requirements; course curricula, capacity rules and retention schedule. Nothing is opened for enrollment until approved.
