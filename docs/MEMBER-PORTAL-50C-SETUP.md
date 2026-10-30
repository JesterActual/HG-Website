# Member Portal: Step 50c, dev-only review

**Status:** experimental implementation targeting `dev`; not production-ready. Public signup is deliberately disabled at Supabase and by a separate Cloudflare environment variable. This PR must not merge into `main`.

## Files
- `member.html`, `member-portal.js`: registration/sign-in interface, TOTP enrollment and challenge, protected member profile view.
- `functions/api/member.js`: same-origin, cookie-based backend gateway to the **HostileGround-DEV** Supabase project, server-side token validation and mandatory `aal2` checks for protected data.

## Cloudflare configuration gates (preview environment only)
These bindings **must** be configured in Cloudflare Pages preview settings before using the page. Do **not** put credentials in source control:
- `HG_ALLOWED_ORIGIN`: `https://dev.hostilegroundevents.com`
- `HG_SUPABASE_URL`: `https://msyfebqblforuvohwxpr.supabase.co`
- `HG_SUPABASE_PUBLISHABLE_KEY`: Supabase DEV publishable key (not secret / service role).
- `HG_SIGNUPS_ENABLED`: `false` (keep disabled until invite-only testing is approved).
- `HG_ACCOUNT_RECOVERY_ENABLED`: `false` (optional; omitted means disabled). Keep recovery email requests off until rate limiting and abuse testing are complete.

The backend refuses requests unless the host and configured project both match DEV. Production bindings are deliberately absent. Do not expose credentials via screenshots.

## Before account testing
1. The custom token-hash email links point to `https://dev.hostilegroundevents.com/auth/confirm.html`. Confirm the Supabase DEV Site URL matches and validate the template links. Review the implemented token-hash confirmation page and recovery endpoints, and configure the two dashboard email templates exactly as documented in `docs/MEMBER-PORTAL-EMAIL-TEMPLATES.md`. Both flows are **untested** and public registration remains disabled by Supabase and `HG_SIGNUPS_ENABLED=false`.
2. Verify that Cloudflare actually builds and runs Pages Functions from this repository's root-directory Pages configuration (and does not silently serve a static-only deployment).
3. Review threat model and security controls: IP/user rate limiting, abuse prevention, anti-enumeration, account-recovery, current-session checks, token revocation, MFA factor rotation, cookie refresh lifetime and CSRF protections.
4. Verify that no preview other than the protected DEV hostname can access the backend. Require the exact origin and fail closed on all missing bindings.
5. Test anonymous / AAL1 / AAL2 access and horizontal RLS isolation with synthetic user accounts. The profile creation API is an initial insert only, not an upsert.
6. Configure protected development access as needed (for example Cloudflare Access) before controlled testing. The DEV hostname is publicly resolvable.

## Security cautions
The JWT `aal` value is checked only after Supabase confirms the token through `/auth/v1/user`; the database separately requires AAL2 via RLS. No service role key is used. Tokens are restricted to HttpOnly Secure SameSite=Strict host cookies, and POST operations require same-origin headers. Browsers never receive Supabase access/refresh tokens through the API's JSON response.

This is a **scaffold**, not a completed or security-audited login system. The callback and recovery endpoints are implemented but untested. The actual confirmation and recovery email templates have been configured manually in Supabase DEV; test deliverability and replay prevention before enabling accounts. Do not enable registration in the dashboard or through Cloudflare bindings.
