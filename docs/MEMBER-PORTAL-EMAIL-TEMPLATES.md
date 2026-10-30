# DEV email confirmation and recovery templates

**Review-only instruction:** The following settings are not automatically installed by PR #35. Public signups must stay disabled.

In Supabase **HostileGround-DEV** (project `msyfebqblforuvohwxpr`) under Authentication > Email Templates, customize **Confirm sign up** and **Reset password** to link to the first-party, no-auto-submit confirmation page. Use the original Supabase `.TokenHash` variable, never the raw token or a service key.

Confirm signup link (template HTML):

```html
<a href="https://dev.hostilegroundevents.com/auth/confirm.html?token_hash={{ .TokenHash }}&type=email">Confirm your Hostile Ground email</a>
```

Reset password link (template HTML):

```html
<a href="https://dev.hostilegroundevents.com/auth/confirm.html?token_hash={{ .TokenHash }}&type=recovery">Verify Hostile Ground account recovery</a>
```

The confirmation page only **posts on user click**, rather than allowing email link scanners to consume the one-time token through a GET. It immediately removes the hash from the browser address bar with `history.replaceState`.

The backend exchanges `token_hash` with Supabase's `/auth/v1/verify`; if a session is issued, it remains in Secure HttpOnly same-site host cookies. This page does not load remote fonts, third-party scripts or analytics.

## Critical recovery limitation
A recovered email link does **not** grant access to protected data or permit a password change on its own: the password-change API requires a verified **AAL2** session. A legitimate user who lost both password and their authenticator needs a separate human-reviewed recovery process; do not bypass MFA in software. If Supabase returns a temporary session after recovery, sign in and complete MFA first, then change password in the Portal.

## Required checks before test registration
- Confirm both dashboard templates were updated and do not contain a default direct-confirmation URL.
- Keep `Allow new users to sign up` off and Cloudflare `HG_SIGNUPS_ENABLED=false`.
- Use the exact configured Supabase DEV Site URL; configure appropriate redirect allowlist entries only if later needed for specific callbacks.
- Verify Supabase email sending limits and enable appropriate external SMTP for real deployment.
- Validate that requesting recovery from an unknown address leaks no account existence and that malicious/cross-origin POSTs fail.
- Manually test expired/replayed tokens and non-consensual email-link prefetching.
- Review the entire gateway, cookie renewal, MFA state, authorization, CSRF and brute-force risks before un-drafting PR #35.
