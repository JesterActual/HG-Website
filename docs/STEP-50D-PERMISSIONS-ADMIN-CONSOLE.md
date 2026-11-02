# Step 50d — Administrative Roles & Individual Permissions Console

Status: **DESIGN PROPOSAL for user review; no database, API, or UI implementation in this PR.**
Target: HostileGround-DEV only, Git branch `dev`. Do not change production or open public signups/recovery.

## Product requirement

Provide a user-friendly, MFA-protected **Permissions Administration** console allowing authorized administrators to assign **role presets** and **individual per-user permissions**. Group permissions by area; show human-readable explanatory text for every control. Checkboxes must distinguish inherited access from manual grants/denials; never mistake a disabled/inherited checkbox for an authorization decision. Save changes only through a trusted, audited backend.

## Role hierarchy and scope

| Role | Default scope | Can manage |
|---|---|---|
| Member (implicit) | Own account, future self-service Academy enrollment | Nobody else's permissions |
| Instructor | Assigned classes and rosters only (plus Member baseline) | Nobody else's permissions by default |
| Academy Admin | Academy management (plus Instructor/Member baselines) | Instructors and Members only; cannot alter Academy Admin or Site Admin accounts |
| Site Admin | Every current and future application permission, always enabled while the role is assigned; no per-user denial can remove access | May manage other users' roles and permissions, but cannot disable any permission for a Site Admin; role changes subject to critical-admin safeguards |

**Specific interpretation of grant-any vs. grant-only-held rules:** An Academy Admin may assign any *Academy-scoped permission they currently possess*, to a lower-ranked Instructor/Member. They cannot assign site-wide permissions, create another Academy Admin, change Site Admins, or grant a permission removed from their own effective permissions. Site Admins alone may assign any assignable permission. Site Admins automatically possess every application permission and cannot disable any of their own permissions or those of another Site Admin. A user never receives authorization from checkboxes alone.

Roles are an inherited baseline, not proof that an individual permission is currently active. The backend determines *current effective privileges*. The role hierarchy governs **target editability** independently of the set of individual permission checkboxes. Academy Admins may not change role grants that confer equal or higher rank, and role change permission must itself be held. Attempts to change another user's rank or grant a role that implicitly adds unauthorized permissions are denied.

## Effective permission evaluation

1. Define a trusted, versioned **permission catalog** (stable keys; label; short description; category; scope; assignable flag; risk; applicable object/resource constraints). No arbitrary user-supplied permission keys.
2. Each role defines a baseline set; Member is implicit; other roles are stored in a private grant table. Role baselines are cumulative where applicable.
3. For Members, Instructors, and Academy Admins only, per-user overrides are **allow / deny / inherit**. `inherit` means no override row. Explicit **deny** overrides their role defaults and individual allows.
4. A user with the authoritative `site_admin` role has **every registered application permission, always enabled**, including future permissions. The backend must **ignore any per-user deny or allow override for Site Admins**; attempts to create or apply Site Admin overrides are rejected. A Site Admin's role cannot coexist with an effective permission denial. This rule is non-configurable through the administration console.
5. Effective permissions: if the account currently holds `site_admin`, return the entire registered application permission catalog without filtering by overrides. Otherwise compute (role-inherited permissions union explicit allows) minus explicit denies. Never use user-editable profile or JWT `user_metadata` as role authority. Recompute from current server-authoritative grants/overrides for each privileged write.
6. A permission may be resource scoped (e.g. `academy.roster.view.assigned`). A broad checkbox does not bypass assigned-session or record-ownership constraints.
7. Mandatory security controls — verified email, MFA AAL2, database RLS, audit logging, CSRF protection, session validity and minimum-administrator recovery safeguards — are **not optional permission switches**, including for Site Admins. Full application permissions do not exempt Site Admins from authentication or platform security controls.

## Permissions and starter catalog (proposed; expand as features launch)

Each key has explicit UI help text and a server-side action mapping.

| Permission key | Category | UI help / actual capability |
|---|---|---|
| `profile.self.view` | Account | See own member profile after MFA |
| `profile.self.edit` | Account | Update own profile display information |
| `academy.catalog.view` | Academy | Browse available courses and sessions when published |
| `academy.registration.self` | Academy | Enroll or cancel own attendance where allowed |
| `academy.sessions.assigned.view` | Instructor | View only training sessions assigned to this instructor |
| `academy.rosters.assigned.view` | Instructor | See rosters for assigned sessions only |
| `academy.attendance.assigned.edit` | Instructor | Record attendance only for assigned sessions |
| `academy.courses.manage` | Academy administration | Create and edit Academy courses and prerequisites |
| `academy.sessions.manage` | Academy administration | Schedule, edit and cancel Academy sessions |
| `academy.enrollments.manage` | Academy administration | Manage Academy enrollments and waitlists |
| `academy.instructors.assign` | Academy administration | Assign instructors to Academy sessions |
| `academy.members.view` | Academy administration | See only member details necessary for Academy operations |
| `academy.permissions.manage_lower` | Permissions | Assign Academy-scoped role/permission changes to Instructors and Members, subject to actor's effective permissions |
| `site.permissions.manage_all` | Site administration | Administer roles and individual permissions across all site accounts |
| `site.settings.manage` | Site administration | Manage global site configuration |
| `site.audit.view` | Site administration | Review relevant authorization/security audit history |
| `site.admins.manage` | Site administration | Create or change Site Admin assignments through a protected, audited procedure |

**Catalog is illustrative**: permissions for future modules are added only with their functionality. Do not present incomplete features as usable. Rank/role management authority is a separate, critical gate from permission toggles.

## Administration interface: accessible & explicit

**Navigation:** signed-in eligible users see `Administration > Users & Permissions`; unauthorized users cannot call its API even if they guess the URL. Require verified email, AAL2, correct origin and CSRF checks for changes.

**User directory:** search by name/email, role filter, enabled/disabled filters, sort. A row shows effective highest role and assigned permissions summary. Members that an Academy Admin may not edit appear read-only or are hidden; no sensitive details leaked.

**User editor:**
- Account header: verified identity, current role(s), effective access count, last change. The editable role preset selector shows only allowed *lower-tier* roles; Site Admin has separate safeguarded role-management controls.
- Permission matrix grouped into **Account, Academy, Instructor, Academy Administration, Site Administration**.
- Each permission row has a **checkbox (effective enabled/disabled)**, a plain-English `What this allows` explanation, a `Role default / Individually allowed / Individually denied` source label, and a **Restore role default** action.
- For Members, Instructors, and Academy Admins, role-inherited permissions start checked; authorized unchecking sets an **explicit deny**, checking an ungranted permission sets an individual **allow**, and `Restore role default` removes the override. **For a Site Admin account, every permission checkbox is checked and read-only**, labeled `Required by Site Admin role — cannot be disabled`. No deny, allow or restore controls are available for Site Admin accounts.
- For viewers without authority, checkboxes are disabled with a specific explanation (`You do not hold this permission`, `Site Admin only`, `Cannot modify equal-or-higher-ranked user`, etc.). Disabled controls are *not* the security boundary.
- Separate an optional `Show only overridden permissions` filter; provide `Show all`, `Only permissions I can grant`; search permissions.
- Use a review dialog before saving: user, role change, permissions added/denied/restored, security-sensitive consequences. Show success only after server confirms, then re-fetch authoritative effective permissions.
- Offer **Audit history** per user: actor, target, reason, UTC timestamp, before/after, request ID, outcome. Never log tokens, passwords or TOTP material.
- Individual permission changes do not silently modify the role preset or override other members.

**Example for Site Admin**: `academy.enrollments.manage` and all other registered permissions are always checked and locked for a Site Admin account; the UI explains that Site Admin permissions cannot be denied. Editing another user's permissions follows the target's role rules. To reduce a Site Admin's powers, a separate, explicitly authorized and audited **role demotion/removal** is required (subject to last-administrator protection), not a permission checkbox. On role promotion to Site Admin, archive/clear any prior individual overrides with an audit event so they cannot silently reappear on later demotion. On demotion, establish the new role baseline and require fresh review of any lower-role overrides.

## Authorization algorithm — enforce at API and database

For **every** role or permission mutation:
1. Authenticate via secure session, verify email + **AAL2**, validate origin/CSRF, check rate limits.
2. Re-read actor role grants, individual overrides, target role/overrides, and permission catalog from trusted backend storage **at write time**; no reliance on stale frontend selections or cached JWT claims.
3. Determine target highest role and requested role transition. Academy Admin may edit only currently lower-ranked targets and may not promote target to equal/higher rank. An ordinary Instructor/Member cannot call role/permission mutation APIs even when they receive individual Academy content permissions.
4. Determine actor grant authority. Site Admin is the sole hierarchy exception with global grant authority; Academy Admin may change only Academy-scoped permissions in the set of their current effective permissions and only if `academy.permissions.manage_lower` is enabled. A non-Site Admin cannot directly or indirectly give a permission they do not hold (including via role presets or privilege bundles). Revoke/deny/restore is also a permission mutation and requires that same authority.
5. Block self-promotion and unapproved self-edit of role/permission grants. **Never accept a per-permission denial (or any other permission override) for a Site Admin target, including self-service or edits by another Site Admin.** Site Admin effective authorization is the complete permission catalog; changes to Site Admin status require a separately authorized, audited role transition and last-administrator safeguard. A Site Admin cannot disable their own access to the permission console via a checkbox.
6. Reject unknown keys, stale/changed target revision (optimistic concurrency), invalid scopes, and disallowed rank/role changes. Perform authorization checks + modifications + append-only audit entry atomically in a trusted database transaction. Use row locks or equivalent to close check-then-write races.
7. Apply database privileges/RLS so users cannot bypass the API to read or mutate the private grants/overrides directly. Sensitive trusted functions, if used, are in private schema and narrowly exposed; no browser service-role key.
8. Recalculate effective grants immediately for subsequent requests. Changed permissions must not remain usable because of stale JWT/long client cache. Site Admin permission checks must always resolve to enabled for every registered application key, irrespective of stale or malicious overrides. Authentication/MFA, RLS, and auditing are still mandatory for all roles.

**Special safeguard**: only Site Admin can assign/revoke `site_admin` or `academy_admin` roles. A Site Admin modification that could eliminate the final usable Site Admin requires a separate supervised recovery procedure; high-impact grants/revocations should require reauthentication/step-up and optional dual approval.

## Storage architecture proposal (not implemented)

- Keep `app_private.member_role_grants` as existing authoritative role assignment table.
- Introduce private `permission_catalog` (or trusted versioned catalog in code), `role_permission_defaults`, and `member_permission_overrides(user_id, permission_key, effect allow|deny, scope?, granted_by, changed_at, reason, revision)`. Enforce unique user/key/scope, FK constraints, strict key validation, and **reject stored overrides for accounts with Site Admin role at the trusted mutation boundary**. Always ignore any legacy override records in Site Admin effective-permission resolution.
- Introduce append-only `permission_audit_events(actor_id, target_id, operation, before, after, reason, recorded_at, request_id)` stored in private schema.
- No direct `anon` or `authenticated` table grants to write private authorization records; an AAL2 server endpoint mediates a narrow, audited trusted transaction.
- Consider a separate immutable administrator-recovery procedure, documented and rehearsed in DEV before PROD.
- Existing `public.member_profiles` continues to hold non-privileged, self-editable profile data only.

## Required DEV acceptance tests

- **Default**: no-role member gets only Member baseline; cannot view admin UI/API; cannot change role or permission.
- **MFA**: signed out/aal1 denied; aal2 permitted only within effective grants; stale/revoked sessions denied.
- **Instructor**: assigned roster only; no arbitrary member records; cannot edit permissions.
- **Academy Admin**: can edit Instructor/Member and assign only Academy permissions they currently hold; cannot edit other Academy Admins/Site Admins; cannot grant site/academy admin roles, site permissions, or role bundles that add absent permissions; cannot give their own explicitly denied permission.
- **Site Admin**: inherits **all** current and future application permissions without exception; every checkbox is checked and read-only; cannot deny or override any permission for self or another Site Admin, including via forged API requests or legacy database override rows; may manage lower users and perform safeguarded role transitions; cannot be locked out by a permission setting.
- **Cross-user**: direct REST/RPC and modified browser requests cannot bypass authorization, no unrestricted `service_role` exposures.
- **Concurrency**: actor revoked, target promoted or policy revision changed during edit => reject; append audit on accepted and rejected attempts as appropriate.
- **Usability**: checkbox, help description, inherited/override status, search/filter, clear save confirmation, audit history accessible to eligible admins.
- **Recovery**: last Site Admin role removal blocked; privileged Site Admin role changes controlled, reviewed and logged. No Site Admin permission-denial recovery is needed because such denials are never accepted or enforced.
- **No deployment leakage**: DEV-only test identities, PROD completely separate.

## Incremental rollout (separate approvals)

A. Approve this design in PR; merge **documentation only** to `dev`.
B. Review and separately approve DEV schema/migrations with RLS/permissions and test harness, including role defaults and overrides. No automatic migration on PR merge.
C. Bootstrap one DEV Site Admin through an explicitly approved trusted procedure; never via a public self-registration endpoint.
D. Implement trusted permission resolver + role/permission edit APIs with automated negative security tests.
E. Build and validate checkbox-based administration UI in DEV, exercise Academy Admin and Site Admin scenarios.
F. Re-audit, document rollback and recovery, and only then plan a separately approved PROD rollout. Public registrations/recovery stay disabled.

This specification supersedes only the authorization/administration portions of older conceptual documents; existing authenticated member profiles, email/MFA, and LOCKBOX event schedule are unchanged.
