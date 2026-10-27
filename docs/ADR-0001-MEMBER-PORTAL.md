# ADR-0001: Unified secure membership and Academy website registration

Status: **Approved architectural direction; not deployed**.

Choose a reusable Hostile Ground Member Portal on the current Cloudflare Pages website, using server-side Cloudflare Pages Functions and Supabase Auth/PostgreSQL (implementation compatibility to be verified in development). Users register once, confirm email and complete mandatory TOTP MFA to AAL2 for protected resources. Role-based server authorization plus database RLS govern Academy and future modules. Academy controls registrations, rosters, waitlists and attendance; Discord is optional for community updates.

Why: Discord Interested cannot ensure confirmed capacity or secure reusable member records. Building passwords or MFA from scratch adds avoidable security risk. Separate Academy-only accounts would fragment future memberships.

Unmerged PR #32 is superseded by this architecture. The existing published Academy page, LOCKBOX schedule, content, links and rules remain unchanged. This decision creates no authentication service, account data, secret or signup endpoint.
