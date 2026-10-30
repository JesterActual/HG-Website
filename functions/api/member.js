// Hostile Ground Member Portal — development-only Cloudflare Pages Function.
// No service-role credential is used. The verified user's JWT is forwarded to RLS.
// Do not merge into main or remove the host/project checks without a security review.
const DEV_ORIGIN = "https://dev.hostilegroundevents.com";
const DEV_SUPABASE = "https://msyfebqblforuvohwxpr.supabase.co";
const ACCESS = "__Host-hg_at";
const REFRESH = "__Host-hg_rt";

function response(data, status = 200, extraHeaders) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, private",
    "Pragma": "no-cache",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Vary": "Cookie"
  });
  if (extraHeaders) for (const [k, v] of extraHeaders.entries()) headers.append(k, v);
  return new Response(JSON.stringify(data), { status, headers });
}
function cookieSet(name, value, age) {
  return name + "=" + encodeURIComponent(value) +
    "; Path=/; Max-Age=" + age + "; Secure; HttpOnly; SameSite=Strict";
}
function addSessionCookies(headers, tokens) {
  if (!tokens || !tokens.access_token || !tokens.refresh_token) return;
  const duration = Math.max(60, Math.min(Number(tokens.expires_in) || 3600, 3600));
  headers.append("Set-Cookie", cookieSet(ACCESS, tokens.access_token, duration));
  headers.append("Set-Cookie", cookieSet(REFRESH, tokens.refresh_token, 86400));
}
function clearSessionCookies(headers) {
  headers.append("Set-Cookie", cookieSet(ACCESS, "", 0));
  headers.append("Set-Cookie", cookieSet(REFRESH, "", 0));
}
function readCookie(request, name) {
  const value = request.headers.get("Cookie") || "";
  const pair = value.split(";").map(s => s.trim()).find(s => s.startsWith(name + "="));
  if (!pair) return "";
  try { return decodeURIComponent(pair.slice(name.length + 1)); } catch { return ""; }
}
function csrfSafe(request) {
  const origin = request.headers.get("Origin");
  const site = request.headers.get("Sec-Fetch-Site");
  return origin === DEV_ORIGIN &&
    request.headers.get("X-HG-Request") === "1" &&
    (!site || site === "same-origin") &&
    (request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase() === "application/json";
}
function configured(ctx) {
  return ctx.env.HG_ALLOWED_ORIGIN === DEV_ORIGIN &&
    ctx.env.HG_SUPABASE_URL === DEV_SUPABASE &&
    !!ctx.env.HG_SUPABASE_PUBLISHABLE_KEY &&
    new URL(ctx.request.url).origin === DEV_ORIGIN;
}
async function remote(env, path, method = "GET", body, token) {
  const headers = {
    "apikey": env.HG_SUPABASE_PUBLISHABLE_KEY,
    "Accept": "application/json",
    "Content-Type": "application/json"
  };
  if (token) headers.Authorization = "Bearer " + token;
  const result = await fetch(env.HG_SUPABASE_URL + path, {
    method, headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "error"
  });
  let payload = {};
  try { payload = await result.json(); } catch {}
  return { ok: result.ok, status: result.status, data: payload };
}
function assurance(token) {
  // Only call after /auth/v1/user has validated the token with Supabase.
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const jwt = JSON.parse(atob(part));
    return jwt.aal === "aal2" ? "aal2" : "aal1";
  } catch { return "aal1"; }
}
async function authenticated(ctx, outHeaders) {
  let access = readCookie(ctx.request, ACCESS);
  const refresh = readCookie(ctx.request, REFRESH);
  let userResponse = access ? await remote(ctx.env, "/auth/v1/user", "GET", undefined, access) : null;
  if ((!userResponse || !userResponse.ok) && refresh) {
    const updated = await remote(ctx.env, "/auth/v1/token?grant_type=refresh_token", "POST", { refresh_token: refresh });
    if (updated.ok && updated.data.access_token && updated.data.refresh_token) {
      access = updated.data.access_token;
      addSessionCookies(outHeaders, updated.data);
      userResponse = await remote(ctx.env, "/auth/v1/user", "GET", undefined, access);
    }
  }
  if (!userResponse || !userResponse.ok || !access) {
    if (readCookie(ctx.request, ACCESS) || refresh) clearSessionCookies(outHeaders);
    return null;
  }
  const user = userResponse.data;
  if (!user || !user.id) return null;
  return { token: access, user, aal: assurance(access) };
}
function factorList(user) {
  return Array.isArray(user.factors)
    ? user.factors.filter(f => f.factor_type === "totp" && f.status === "verified")
      .map(f => ({ id: f.id, name: f.friendly_name || "Authenticator" }))
    : [];
}
function requireMember(auth) {
  return !!(auth && auth.user.email_confirmed_at && auth.aal === "aal2");
}
function failure(message, code, headers) { return response({ error: message }, code, headers); }
function validUuid(s) { return typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s); }
function validCode(s) { return typeof s === "string" && /^[0-9]{6}$/.test(s); }
function validEmail(s) { return typeof s === "string" && s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }
async function readJson(req) {
  const len = Number(req.headers.get("Content-Length") || 0);
  if (len > 8192) throw new Error("Request too large");
  const raw = await req.text();
  if (raw.length > 8192) throw new Error("Request too large");
  const body = JSON.parse(raw);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid request");
  return body;
}

export async function onRequest(ctx) {
  if (!configured(ctx)) return failure("Member Portal is not configured for this development origin.", 503);
  const req = ctx.request;
  const method = req.method;
  const action = new URL(req.url).searchParams.get("action");
  if ((method !== "GET" && method !== "POST") || (method === "POST" && !csrfSafe(req)))
    return failure("Request not permitted.", 403);
  const headers = new Headers();
  try {
    if (method === "POST" && action === "logout") {
      const token = readCookie(req, ACCESS);
      if (token) await remote(ctx.env, "/auth/v1/logout", "POST", {}, token).catch(() => null);
      clearSessionCookies(headers);
      return response({ state: "signed_out" }, 200, headers);
    }
    if (method === "POST" && action === "signup") {
      if (ctx.env.HG_SIGNUPS_ENABLED !== "true") return failure("Registration is not open.", 403);
      const b = await readJson(req);
      if (!validEmail(b.email) || typeof b.password !== "string" || b.password.length < 12 || b.password.length > 128)
        return failure("Enter a valid email and a password of 12–128 characters.", 400);
      // Confirmation links come from the custom DEV token-hash email template.
      const result = await remote(ctx.env, "/auth/v1/signup", "POST",
        { email: b.email.trim(), password: b.password });
      if (!result.ok) return failure("Registration could not be completed.", result.status === 429 ? 429 : 400);
      return response({ message: "Check your email for verification instructions. If you already have an account, sign in." });
    }
    if (method === "POST" && action === "request_recovery") {
      // Keep email-sending recovery disabled until anti-abuse controls are tested.
      if (ctx.env.HG_ACCOUNT_RECOVERY_ENABLED !== "true")
        return failure("Account recovery is not available during development.", 403, headers);
      const b = await readJson(req);
      if (!validEmail(b.email)) return failure("Enter a valid email address.", 400);
      // The response reveals neither account existence nor email-delivery status.
      const r = await remote(ctx.env, "/auth/v1/recover", "POST", { email: b.email.trim() });
      if (r.status === 429) return failure("Too many requests. Try again later.", 429);
      return response({ message: "If this email address has an account, recovery instructions will arrive shortly." }, 200, headers);
    }
    if (method === "POST" && action === "confirm") {
      const b = await readJson(req);
      if (typeof b.tokenHash !== "string" || !/^[a-f0-9]{64}$/i.test(b.tokenHash) ||
          (b.type !== "email" && b.type !== "recovery"))
        return failure("Invalid or expired confirmation link.", 400);
      // One-use hash exchange is POSTed; a GET or link preview cannot consume it.
      const r = await remote(ctx.env, "/auth/v1/verify", "POST",
        { token_hash: b.tokenHash, type: b.type });
      if (!r.ok) return failure("This link is invalid, expired, or has already been used.", 400);
      if (!r.data.access_token || !r.data.refresh_token) {
        if (b.type === "email")
          return response({ state: "confirmed", loginRequired: true }, 200, headers);
        return failure("Recovery could not establish a session. Request another link.", 400);
      }
      addSessionCookies(headers, r.data);
      return response({ state: "confirmed", loginRequired: false, recovery: b.type === "recovery" }, 200, headers);
    }
    if (method === "POST" && action === "login") {
      const b = await readJson(req);
      if (!validEmail(b.email) || typeof b.password !== "string") return failure("Invalid credentials.", 401);
      const result = await remote(ctx.env, "/auth/v1/token?grant_type=password", "POST",
        { email: b.email.trim(), password: b.password });
      if (!result.ok || !result.data.access_token || !result.data.refresh_token)
        return failure("Invalid credentials or unverified email.", result.status === 429 ? 429 : 401);
      if (!result.data.user || !result.data.user.email_confirmed_at)
        return failure("Confirm your email before signing in.", 403);
      addSessionCookies(headers, result.data);
      return response({ state: "signed_in" }, 200, headers);
    }
    const auth = await authenticated(ctx, headers);
    if (method === "GET" && action === "status") {
      const open = ctx.env.HG_SIGNUPS_ENABLED === "true";
      const recoveryOpen = ctx.env.HG_ACCOUNT_RECOVERY_ENABLED === "true";
      if (!auth) return response({ state: "signed_out", signupOpen: open, recoveryOpen }, 200, headers);
      if (!auth.user.email_confirmed_at) return response({ state: "verify_email", signupOpen: open, recoveryOpen }, 200, headers);
      if (auth.aal !== "aal2") {
        const factors = factorList(auth.user);
        return response({ state: factors.length ? "verify_mfa" : "enroll_mfa",
          factorId: factors[0]?.id || null, signupOpen: open, recoveryOpen }, 200, headers);
      }
      return response({ state: "ready", signupOpen: open, recoveryOpen,
        user: { id: auth.user.id, email: auth.user.email } }, 200, headers);
    }
    if (!auth || !auth.user.email_confirmed_at) return failure("Sign-in and email verification required.", 401, headers);
    if (method === "POST" && action === "enroll") {
      if (auth.aal !== "aal1" && auth.aal !== "aal2") return failure("Sign in first.", 401, headers);
      if (factorList(auth.user).length && auth.aal !== "aal2")
        return failure("Verify your existing authenticator first.", 403, headers);
      const result = await remote(ctx.env, "/auth/v1/factors", "POST",
        { factor_type: "totp", friendly_name: "Hostile Ground" }, auth.token);
      if (!result.ok) return failure("Unable to begin authenticator setup.", 400, headers);
      return response({ factorId: result.data.id,
        qrCode: result.data.totp?.qr_code || null,
        secret: result.data.totp?.secret || null }, 200, headers);
    }
    if (method === "POST" && (action === "challenge" || action === "verify")) {
      const b = await readJson(req);
      if (!validUuid(b.factorId)) return failure("Invalid authenticator.", 400, headers);
      if (action === "challenge") {
        const result = await remote(ctx.env, "/auth/v1/factors/" + b.factorId + "/challenge", "POST", {}, auth.token);
        if (!result.ok) return failure("Unable to initiate authenticator challenge.", 400, headers);
        return response({ challengeId: result.data.id }, 200, headers);
      }
      if (!validUuid(b.challengeId) || !validCode(b.code)) return failure("Invalid verification code.", 400, headers);
      const result = await remote(ctx.env, "/auth/v1/factors/" + b.factorId + "/verify", "POST",
        { challenge_id: b.challengeId, code: b.code }, auth.token);
      if (!result.ok || !result.data.access_token || !result.data.refresh_token)
        return failure("Authenticator verification failed.", 401, headers);
      addSessionCookies(headers, result.data);
      return response({ state: "mfa_verified" }, 200, headers);
    }
    if (!requireMember(auth)) return failure("Complete two-factor authentication.", 403, headers);
    if (method === "POST" && action === "change_password") {
      // The member gate immediately above requires a verified email and AAL2.
      // An email recovery link on its own provides no MFA bypass.
      const b = await readJson(req);
      if (typeof b.password !== "string" || b.password.length < 12 || b.password.length > 128)
        return failure("Choose a password of 12–128 characters.", 400, headers);
      const result = await remote(ctx.env, "/auth/v1/user", "PUT", { password: b.password }, auth.token);
      if (!result.ok) return failure("Password update unsuccessful. Additional verification may be required.", 400, headers);
      return response({ message: "Password changed. Sign out and sign in again on other devices." }, 200, headers);
    }
    if (method === "GET" && action === "profile") {
      const r = await remote(ctx.env, "/rest/v1/member_profiles?select=user_id,display_name&user_id=eq." +
        encodeURIComponent(auth.user.id), "GET", undefined, auth.token);
      if (!r.ok) return failure("Profile is not available.", 503, headers);
      return response({ profile: Array.isArray(r.data) && r.data.length ? r.data[0] : null }, 200, headers);
    }
    if (method === "POST" && action === "profile") {
      const b = await readJson(req);
      const name = typeof b.displayName === "string" ? b.displayName.trim() : "";
      if (name.length > 80) return failure("Display name must be 80 characters or fewer.", 400, headers);
      const r = await remote(ctx.env, "/rest/v1/member_profiles?on_conflict=user_id", "POST",
        { user_id: auth.user.id, display_name: name || null }, auth.token);
      // "Prefer" upsert semantics are deliberately not enabled: profiles must not
      // be overwritten via a loosely scoped upsert. First write inserts only.
      if (!r.ok) return failure("Unable to create profile. Existing profiles are read-only in this first release.", 409, headers);
      return response({ message: "Profile created." }, 200, headers);
    }
    return failure("Unknown action.", 404, headers);
  } catch {
    // Never log passwords, OTP values, token hashes, cookies, or upstream responses.
    return failure("Member Portal request could not be completed.", 500, headers);
  }
}
