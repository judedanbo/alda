# ADLA Public Application — Cybersecurity Assessment

**Scope:** Nuxt 4 application at `app/` (server APIs, auth/authorization, file uploads, object storage, business-logic state machine, network controls, secret handling).
**Method:** Static review of source, configuration, dependency manifests, and architectural patterns. No live testing or DAST.
**Threat model:** Public-internet government PII portal (Ghana Card images, asset declarations under Article 286(5)). Adversaries assumed to have source code, the ability to register applicant accounts, and — for some findings — the ability to compromise a low-privilege staff role.

---

## Executive Summary

The codebase shows real defensive engineering — layered rate limiting, audit logging, Zod validation on most write paths, Prisma parameterized queries, escaped email templates, randomized upload filenames, IDOR checks on declaration access. **There is no SQL injection, no XSS in templates, no command injection, no SSRF, and no open-redirect vector.**

However, several issues are serious enough to block production launch of a system handling national-ID data:

- **Hardcoded fallback secrets** (JWT signing, MinIO credentials, analytics IP salt) silently flow to production if any env var is unset.
- **`X-Forwarded-For` is trusted unconditionally** for rate limiting, abuse scoring, and audit IPs — trivially spoofable when the app is not behind a verified proxy.
- **JWT access and refresh tokens are stored in cookies without `HttpOnly`/`Secure`**, so any XSS = full account takeover.
- **No global security-response-header middleware** (no CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy).
- **Ghana Card numbers and full names are written verbatim into `audit_logs` and CSV/PDF exports**; the database column is plaintext with a unique index.
- **File-upload MIME validation trusts the client `Content-Type`** with no magic-byte verification, and generic uploads are written with `x-amz-acl: public-read`.
- **Login has no per-account brute-force limit**, and the failed-login response is timing-distinguishable from a non-existent user.
- **Rate limiting fails open on Redis errors**, including on the auth endpoints.

A full prioritized finding list follows.

---

## CRITICAL

### C-1. Hardcoded fallback secrets ship to production silently

`nuxt.config.ts:70-72, 81-82, 116`

```ts
jwtSecret: process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production",
jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "your-refresh-secret-key-change-in-production",
...
minioAccessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
minioSecretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
...
ipSalt: process.env.ANALYTICS_IP_SALT || "change-this-analytics-ip-salt-in-production",
```

If `JWT_SECRET` is missing in any environment, every signed token can be forged by anyone with the source (the fallback string is committed to git). The MinIO fallback is the well-known `minioadmin:minioadmin` default — an attacker who can reach the MinIO endpoint owns every Ghana Card image. The analytics IP salt fallback nullifies IP-hash privacy (the salt is public).

**Fix:** In `nuxt.config.ts`, fail startup when these env vars are missing in production:

```ts
const required = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`${name} must be set`);
  return v;
};
// in runtimeConfig:
jwtSecret: process.env.NODE_ENV === "production" ? required("JWT_SECRET") : (process.env.JWT_SECRET || "dev-secret"),
```

Apply the same pattern to `JWT_REFRESH_SECRET`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `ANALYTICS_IP_SALT`, and `NOTIFICATIONS_SMS_WEBHOOK_SECRET`.

---

### C-2. `X-Forwarded-For` / `X-Real-IP` trusted with no proxy verification

`app/server/utils/request-meta.ts:15-26`

```ts
export function extractClientIp(event: H3Event): string {
  const forwarded = getHeader(event, "x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  const real = getHeader(event, "x-real-ip");
  if (real) return real.trim();
  ...
}
```

Every consumer of this function — the per-IP rate limiter, abuse scorer, audit-log IP field, traffic capture — accepts attacker-supplied IPs verbatim. If the app is exposed directly, or behind a proxy that does not strip incoming forwarding headers, an attacker rotates `X-Forwarded-For` per request and **every limit, block, and abuse signal is bypassed**. Audit IPs become attacker-chosen strings (the same path is used in `app/server/utils/audit.ts:21` and `app/server/api/contact.post.ts:37`).

**Fix:** Take the client IP from the socket by default; only accept forwarded headers when the immediate socket peer is in a configured trusted-proxy list. Document the trusted-proxy requirement.

---

### C-3. JWT access + refresh tokens stored in non-`HttpOnly`, non-`Secure` cookies

`app/plugins/auth.ts:5-13`

```ts
const COOKIE_OPTIONS = { maxAge: COOKIE_MAX_AGE, path: "/", sameSite: "lax" as const };
const accessTokenCookie = useCookie("adla_access_token", COOKIE_OPTIONS);
const refreshTokenCookie = useCookie("adla_refresh_token", COOKIE_OPTIONS);
```

`useCookie` defaults to `httpOnly: false, secure: false`. Any reflected/stored XSS — including via a future field with v-html, a markdown renderer, or a third-party widget — yields both tokens via `document.cookie`. With the 7-day refresh token, that's persistent account takeover.

The server middleware itself only reads `Authorization: Bearer …` (good — no CSRF on protected APIs), so the cookies are effectively a client-side bootstrap mirror of `localStorage`. They double the XSS surface without adding a defensive property.

**Fix (recommended):** Stop persisting tokens in cookies. Keep them in memory + `localStorage` only (existing path) — the cookie mirror in `plugins/auth.ts` is unnecessary. If cookies are kept, set `httpOnly: true, secure: true, sameSite: "strict"` and move bearer extraction to the server.

---

### C-4. Hardcoded `public-read` ACL on generic uploads (reissue letters, receipts)

`app/server/services/storage.service.ts:65-68`

```ts
await client.putObject(bucket, key, file, file.length, {
  "Content-Type": contentType,
  "x-amz-acl": "public-read",
});
```

`uploadFile()` is used by the reissue-letter upload (`app/server/api/upload/reissue-letter.post.ts`) and receipt PDF writes (via `uploadBuffer`). Anything reachable via `http://<minio>/<bucket>/<key>` is world-readable. UUID-keyed paths buy *some* obscurity, but URL leakage (referrer, logs, screenshots, mailto) reveals the document. Ghana Card and alternate-ID writes use `putObject` *without* an ACL — they inherit the bucket default, which is undefined by this code (`ensureBucket()` does not set a policy).

**Fix:** Remove `x-amz-acl: public-read` everywhere. Set a private bucket policy at deploy time. Serve every download through a per-request short-lived presigned URL (the helper at `storage.service.ts:192` exists but is not used by the upload responses).

---

### C-5. Plaintext PII in `audit_logs` JSON columns

`app/server/api/profile/index.post.ts:104-110`, `app/server/api/auth/register.post.ts:120`, multiple other state-transition endpoints.

```ts
newValues: {
  fullName: profile.fullName,
  idType: profile.idType,
  ghanaCardNumber: profile.ghanaCardNumber,
  alternateIdNumber: profile.alternateIdNumber,
  ...
}
```

`audit_logs.newValues` and `oldValues` are JSON columns. They store the full PII of every profile create/update, including the Ghana Card number. Combined with `applicant_profiles.ghana_card_number` being plaintext + uniquely indexed (`app/prisma/schema.prisma:143`), one read of the audit table yields a name→ID dictionary of every applicant ever.

**Fix:**
- Application-level encryption (or PostgreSQL pgcrypto) for `ghanaCardNumber`, `alternateIdNumber`, and any other national-ID column. Equality lookups can use a salted HMAC index instead of a plaintext unique index.
- Audit logs should record the diffed *field names* and a reference ID — not the values. Where the value is genuinely needed for compliance, store it under a separate access-controlled secret-redacted table.

---

### C-6. CSV / PDF export dumps unredacted Ghana Card numbers

`app/server/api/analytics/declarations/export.get.ts:46, 86-89`

```ts
applicant: { select: { fullName: true, idType: true, ghanaCardNumber: true, alternateIdNumber: true } }
...
idNumber: decl.applicant.idType === "GHANA_CARD"
  ? decl.applicant.ghanaCardNumber
  : decl.applicant.alternateIdNumber,
```

The export is gated to `admin`/`schedule_officer` (acceptable), but any compromised officer account exfiltrates the entire applicant PII database in one HTTP call. There is no row-level access control to limit officers to their own institution/office (see H-3).

**Fix:** Mask the ID column by default (`GHA-XXXXXXX-Δ`, retaining only the last digit). Provide an explicit, separately-audited "unmasked export" capability that requires a second factor / approval workflow.

---

## HIGH

### H-1. Rate limiter fails open on storage error — including on auth endpoints

`app/server/utils/rate-limit.ts` (catch block returns `{ allowed: true, ... }`), `app/server/middleware/00.security.ts:141-145`

Both the storage-helper layer and the security middleware swallow exceptions and let the request through. A Redis outage (or the in-memory fallback being misused in a multi-instance deploy) disables every rate limit, including the 15 req/min auth limit. Brute-forcing login becomes free.

**Fix:** Apply a conservative local fallback (e.g., a tiny in-memory token bucket per route group with strict limits) when shared storage is unavailable, so the system fails to a degraded-but-safe mode rather than open.

---

### H-2. No per-account login lockout; timing leak on user enumeration

`app/server/api/auth/login.post.ts:23-35, 52-66`

- Failed logins are *audit-logged* but not *counted toward a lockout*. With the per-IP limit (C-2) trivially bypassable, distributed credential stuffing is unconstrained.
- When the user doesn't exist (line 23), the handler skips `bcrypt.compare` (~100 ms) and returns immediately. Existing accounts take measurably longer, leaking which emails are registered even though the message is the same.
- `register.post.ts:21-27` and `register.post.ts:38-46` *do* return distinct errors for duplicate email / duplicate phone — direct enumeration.
- `check-phone.get.ts` returns `{ available: true|false }` as a public allow-listed endpoint with no dedicated rate limit — a phone-number enumeration oracle.

**Fix:** Per-account failure counter with a sliding window lockout (e.g., 10 fails / 15 min → 1 hour cool-down) tied to `user.id`. Run a dummy `bcrypt.compare` against a constant fake hash on the "user not found" path to equalize timing. For `check-phone`, return `{ available: true }` for any well-formed number to remove the enumeration oracle, validating uniqueness only at registration.

---

### H-3. Officer/legal endpoints have no institution/office scoping

`app/server/api/form-collections/index.post.ts`, `app/server/api/form-returns/index.post.ts`, `app/server/api/reviews/index.post.ts`, `app/server/api/receipts/[declarationId].post.ts`, `app/server/api/legal/form-reissues/[id].get.ts`

Role gating via the `/api/officer` and `/api/legal` prefixes only checks *role membership*, not *resource ownership* within that role's scope. A schedule officer for office A can record a form collection against a declaration assigned to office B; a legal-unit officer at one institution can list and inspect any reissue request by iterating IDs (note: this is a UUID search, not enumeration of sequential IDs — but the handler still leaks full applicant PII once you have a known UUID, e.g., from a referenced declaration).

**Fix:** Add explicit ownership checks. Officers should be scoped to a `CollectionOffice` (or set thereof) on the user row; every officer-action handler should verify the target declaration's office matches the actor's. Same for legal-unit-vs-institution where applicable.

---

### H-4. File-upload validation trusts client `Content-Type`; no magic-byte / sniff check

`app/server/services/storage.service.ts:204-226`, `app/server/api/upload/ghana-card.post.ts:45-56`

```ts
const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
if (!allowedTypes.includes(contentType)) { ... }
```

`contentType` is `fileField.type` straight from the multipart upload — attacker-controlled. The stored object is then served back with that same client-supplied Content-Type. An attacker can upload an HTML or SVG payload labelled `image/jpeg`; when fetched by the admin reviewer with a browser that respects `X-Content-Type-Options: nosniff` (which the app doesn't set — see H-5), or by a user agent that sniffs, it can execute.

Decompression-bomb / image-bomb protection is also absent.

**Fix:** Read the first N bytes and verify against a magic-byte table (`file-type` npm). Reject anything where the declared type doesn't match the detected type, or where SVG/HTML is detected. Force a stable, safe response `Content-Type` (e.g., `image/jpeg` for `.jpg`) and serve with `Content-Disposition: attachment` for sensitive documents. Add `X-Content-Type-Options: nosniff` globally.

---

### H-5. No global security-response-header middleware

No CSP, HSTS, X-Content-Type-Options, X-Frame-Options/frame-ancestors, Referrer-Policy, or Permissions-Policy is set. The app is exposed to clickjacking, MIME sniffing of uploads (H-4), and protocol downgrade.

**Fix:** Add a small Nitro middleware (e.g., `app/server/middleware/01.security-headers.ts`) that sets these on every response:

```ts
setResponseHeader(event, "Strict-Transport-Security", "max-age=31536000; includeSubDomains");
setResponseHeader(event, "X-Content-Type-Options", "nosniff");
setResponseHeader(event, "X-Frame-Options", "DENY");
setResponseHeader(event, "Referrer-Policy", "strict-origin-when-cross-origin");
setResponseHeader(event, "Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
setResponseHeader(event, "Content-Security-Policy",
  "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; " +
  "script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'");
```

Tune the CSP against the real Nuxt asset surface (apexcharts, etc.) before shipping.

---

### H-6. MinIO endpoint uses plaintext HTTP

`app/server/services/storage.service.ts:15`, URL templates at `:71, :109, :148, :177`

```ts
useSSL: false,
...
const url = `http://${config.minioEndpoint}:${config.minioPort}/${bucket}/${key}`;
```

If MinIO is accessed across any non-loopback network (a VPC peer, a different node), Ghana Card images and credentials traverse plaintext. The constructed URL is also stored and surfaced to clients — even the URL itself is `http://`.

**Fix:** Set `useSSL: true` and an HTTPS endpoint. Stop emitting absolute object URLs from the upload helpers; return only the object key and have a separate signed-URL endpoint mint short-lived URLs on demand.

---

### H-7. Refresh-token replay not detected

`app/server/api/auth/refresh.post.ts`

The handler validates and deletes a refresh token, issuing a new pair (good rotation). It does not detect *re-use* of an already-rotated token — an attacker who has stolen a refresh token (e.g., from a non-HttpOnly cookie via XSS, see C-3) can use it once, after which the legitimate user's next refresh attempt fails silently. There's no "family invalidation" that would force re-authentication and surface the compromise.

**Fix:** Persist a `family_id` per issued refresh token. On refresh, mark the old as consumed and chain to a new one in the same family. If a refresh token is presented after consumption, invalidate the entire family and force re-login.

---

### H-8. Receipt number uses `Math.random()`

`app/server/services/pdf.service.ts:381-386`

```ts
const random = Math.random().toString(36).substring(2, 8).toUpperCase();
const sequence = Date.now().toString().slice(-6);
return `RCP-${year}-${sequence}-${random}`;
```

`Math.random()` is not cryptographically random; the timestamp half is fully predictable. Predictable receipt numbers undermine the offline-verification flow.

**Fix:** Use `crypto.randomBytes(4).toString("hex").toUpperCase()` or the same approach used in `generateUniqueCode` (`code-generator.ts:7`).

---

## MEDIUM

### M-1. TOCTOU on "no second active declaration" check

`app/server/api/declarations/index.post.ts:57-96`

The findFirst→create sequence is not transactional and there's no partial unique index `(applicant_id) WHERE status IN ('CODE_GENERATED','FORM_COLLECTED','SUBMITTED','UNDER_REVIEW','APPROVED')`. Two concurrent POSTs can both create a declaration.

**Fix:** Add the partial unique index in a Prisma migration, catch the `P2002` unique violation and return 409.

### M-2. TOCTOU on form-reissue request creation

`app/server/api/declarations/[id]/reissue-request.post.ts:36-93`

Same shape as M-1: read-check then write inside `$transaction` but the read is outside it. Add a partial unique index on `(declaration_id) WHERE status = 'PENDING'`.

### M-3. SMS webhook secret defaults to empty

`.env.example:51` (`NOTIFICATIONS_SMS_WEBHOOK_SECRET=""`)

If unset, the SMS-delivery webhook accepts any caller, letting an attacker forge delivery statuses (mark legitimate SMS as failed/delivered). Currently a routed public path (`app/server/middleware/auth.ts:25`).

**Fix:** Treat as required in production (C-1 pattern). The handler must reject unsigned requests when in production.

### M-4. Modulo bias in 6-digit phone-verification code

`app/server/api/auth/send-phone-code.post.ts:9-16`

`(uint32 % 1_000_000)` introduces ~0.13 bit of bias. Combined with the per-token attempt count and resend throttle, the practical impact is small, but the fix is one line.

**Fix:** Use `crypto.randomInt(1_000_000)` from `node:crypto`.

### M-5. Email subjects and message bodies include unique codes / rejection reasons

`app/server/services/email.service.ts:118`, `app/server/notifications/payloads.ts:21,65`

Email subjects/bodies are logged by mail-server infrastructure (and SMS provider logs for the SMS variant). Sending the unique declaration code in the subject line leaks it to anyone with logs access along the path.

**Fix:** Treat codes/reasons as in-app secrets — email a magic-link to view in-app, don't put the code in the subject. At minimum, only include the code in the body and label the subject generically.

### M-6. Bucket default policy not asserted by `ensureBucket`

`app/server/services/storage.service.ts:26-31`

The bootstrap creates the bucket if missing but never sets a policy. The bucket's effective ACL is determined by whatever default MinIO ships with (which has varied across releases). Combined with C-4, this is a configuration cliff.

**Fix:** Have `ensureBucket()` apply an explicit deny-all-public policy. Document it as the source of truth.

### M-7. Per-user rate limit (600 req/min) is high for write-heavy endpoints

`nuxt.config.ts:129`, `app/server/middleware/rate-limit-user.ts`

10 req/sec on every authenticated route means a single user can fire ~3000 PDF generations or ~3000 audit-log-emitting writes per 5 minutes. The IP-uploads bucket (`uploadPer5Min: 30`) helps but the route-group classifier isn't applied per *user*.

**Fix:** Apply the route-group classifier on the user limiter too, with a much smaller `userWritePerMin` and `userUploadPer5Min`.

### M-8. Demo seed scripts not gated against production

`app/prisma/seed.ts`, `app/prisma/seed-demo.ts` create accounts with hardcoded passwords.

**Fix:** Fail the seed scripts if `NODE_ENV === "production"` (or if `DATABASE_URL` matches a prod allowlist pattern). Surface the danger in the script header.

### M-9. Verify-by-code endpoint not rate-limited beyond global limits

`app/server/api/verify/[code].get.ts`

A compromised `legal_unit`/`schedule_officer` account can iterate codes at the global per-user rate (~600/min). Code space per day is ~33.5M random alphanumerics, so brute-force is infeasible in absolute terms — but issued codes are sparse and dated, and any officer can scan today's issued codes by paging the declarations list anyway. Treat this as defense-in-depth rather than a flaw, but tighten the limit specifically here.

**Fix:** Cap `/api/verify/*` to 30 req/min per user.

### M-10. Audit log writes are best-effort and silent on failure

`app/server/utils/audit.ts:27-44`

`createAuditLog` catches and logs to console. Compliance-grade audit trails should either fail-closed (block the action if it can't be logged) or write to a durable queue with retries.

**Fix:** Push audit events through the same BullMQ pipeline used for notifications, with a tight per-event SLA and dead-letter queue.

---

## LOW / INFORMATIONAL

### L-1. Bcrypt cost factor 12

`app/server/api/auth/register.post.ts:63`, `reset-password.post.ts:46` — cost 12 is OWASP-acceptable. Argon2id is preferable for new builds, but not a blocker. *No change required.*

### L-2. JWT lacks `iss` / `aud` claims

`app/server/utils/jwt.ts:18-35` — purely defensive hardening. Add `audience: "adla"`, `issuer: "adla-auth"`, and verify them, to make compromise of the secret in any other service (unlikely here, only one service uses it) less impactful.

### L-3. Public registration leaks email/phone existence

`register.post.ts:21-27, 38-46` — UX vs. enumeration trade-off. Acceptable if a per-IP/per-account aggressive limiter is in place (which it isn't — see H-2). Either tighten the limiter or change the response to a generic 409 without indicating which field collided.

### L-4. Email verification not required to authenticate

`register.post.ts:99-103` issues access+refresh tokens before the email is verified. Anyone can register with a typo'd or someone-else's email and use the system. Decide whether email verification is a hard gate (matching the Ghana Card workflow it precedes).

### L-5. `useSSL: false` default; `secure` cookie flag only set in production

`storage.service.ts:15`, `plugins/traffic.ts:60`. Acceptable defaults for dev; document the production checklist.

### L-6. GitHub Actions not pinned to commit SHA

`.github/workflows/*.yml` — supply-chain hardening; pin actions to full commit SHAs.

### L-7. Several admin endpoints validate manually instead of via Zod

`app/server/api/admin/users/[id]/roles.put.ts:29-30`, `…/status.patch.ts`, `…/institutions/index.post.ts:28-29`, `…/institutions/[id].put.ts:28-29` — functionally safe today (downstream Prisma constraints reject malformed values), but inconsistent and prone to regressions. Standardize on `validateBody(event, schema)`.

### L-8. AI-crawler block is UA-based

`app/server/utils/ai-agents.data.ts` — UA matching is a politeness mechanism, not security. The cloaked-bot heuristics in `plugins/traffic.ts` are the actual defense; document that explicitly.

### L-9. Audit `userId` allowed to be unset on failed-login records

`app/server/api/auth/login.post.ts:25-29` — when the user doesn't exist, the audit record has `newValues.email` but no `userId`. Combined with the lack of source-IP capture in some audit calls (handled by `audit.ts:21`, but only via the spoofable header), correlating attacks is hard.

---

## What's confirmed safe

These were checked and found in good shape — keep doing them.

- **No SQL injection.** All `$queryRaw` / `Prisma.sql` call sites bind parameters; the small set of `Prisma.raw(...)` calls use hardcoded identifiers (`app/server/api/admin/analytics/*.ts`).
- **No XSS in server-rendered email templates.** The `esc()` helper in `app/server/notifications/email-templates/layout.ts:22-30` correctly escapes all five HTML-significant characters and is applied uniformly across the 16 templates.
- **No `v-html` on user-controlled data** in the Vue tree.
- **No SSRF.** All outbound fetches target hardcoded provider URLs (`sms.service.ts`, `ai-agents.ts`).
- **No command injection.** No `child_process` calls.
- **No path traversal in uploads.** Filenames are replaced with UUIDs (`storage.service.ts:62`) or sanitized character classes (`:141`).
- **CSRF on protected APIs is not exploitable.** Server-side auth reads only `Authorization: Bearer …` (`app/server/utils/jwt.ts:74-80`); cookies are a client-side bootstrap mirror.
- **Password-reset flow** uses 256-bit tokens, one-hour expiry, one-time use, revokes refresh tokens on use, and equalizes the response message (`forgot-password.post.ts:14-21`, `reset-password.post.ts`).
- **Declaration unique-code generation** uses `crypto.randomBytes` with a confusables-stripped alphabet, no modulo bias (32 divides 256). Sufficient entropy for the workflow.
- **Prisma singleton** correctly attached to `globalThis` in dev.
- **`npm audit --omit=dev`** clean at the time of review.

---

## Prioritized remediation roadmap

**Before any public traffic (P0):**
1. C-1: required-secret startup validation (JWT, MinIO, IP salt, SMS webhook).
2. C-3: drop the cookie mirror, or set HttpOnly+Secure+SameSite=strict.
3. H-5: ship the security-response-headers middleware.
4. C-4 + M-6: stop emitting `public-read`, set explicit private bucket policy.
5. C-2: socket-IP-by-default; trusted-proxy allowlist.
6. H-6: MinIO over TLS; remove plaintext URLs from API responses.
7. H-4: magic-byte upload validation.

**Sprint 1 (P1):**
8. C-5 + C-6: encrypt national-ID columns; mask in audit logs and exports.
9. H-1: rate-limit fail-closed fallback.
10. H-2: per-account lockout + timing-equalized login.
11. H-3: per-officer institution/office scoping.
12. H-7: refresh-token family detection.
13. H-8: cryptographic receipt numbers.

**Sprint 2 (P2):**
14. M-1, M-2: partial unique indexes for active declaration / pending reissue.
15. M-3: enforce SMS webhook secret.
16. M-5: remove sensitive content from email subjects / SMS bodies.
17. M-7: route-group-aware per-user limits.
18. M-9 / M-10: per-route verify limit, audit via durable queue.
19. L-1 through L-9 backlog cleanups.

---

*Assessment generated for branch `claude/cybersecurity-assessment-public-app-P1MS5`.*
