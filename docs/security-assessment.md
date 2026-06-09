# ADLA Public Application — Cybersecurity Assessment

**Last reviewed:** 2026-06-09 (branch `claude/cyber-security-assessment-x3b6jb`)
**Scope:** Nuxt 4 application at `app/` (server APIs, auth/authorization, file uploads, object storage, business-logic state machine, network controls, secret handling, PII protection).
**Method:** Static review of source, configuration, dependency manifests, and architectural patterns. No live testing or DAST.
**Threat model:** Public-internet government PII portal (Ghana Card images, asset declarations under Article 286(5)). Adversaries assumed to have source code, the ability to register applicant accounts, and — for some findings — the ability to compromise a low-privilege staff role.

This document supersedes the prior assessment (originally produced on branch
`claude/cybersecurity-assessment-public-app-P1MS5`). Since that review, the team
remediated essentially every CRITICAL and HIGH finding; the prior text described a
codebase that no longer exists. Section 1 records the disposition of every prior
finding. Section 2 lists what this re-assessment found still open — all three
code-level items were fixed on this branch. Section 3 is the remaining backlog
(deployment-checklist and hardening items, not launch blockers). Section 4 lists
controls verified safe.

---

## Executive Summary

The codebase now demonstrates defense-in-depth across every area the prior
assessment flagged: a production startup gate refuses to boot with committed
fallback secrets; forwarded-IP headers are honored only from a configured
trusted-proxy CIDR list; tokens are bearer-header-only (no cookie mirror);
object storage is private with app-signed, TTL-limited download URLs; national-ID
columns are AES-256-GCM encrypted with HMAC lookup columns; audit values are
PII-scrubbed; exports are masked; uploads are magic-byte verified; login has
per-account lockout with timing equalization; refresh tokens rotate in families
with replay teardown; and a security-headers middleware ships CSP, HSTS,
X-Frame-Options, and friends.

This re-assessment found **no CRITICAL or HIGH issues**. Three lower-severity
gaps were identified and fixed on this branch:

1. **JWT algorithm not pinned** (Medium-Low) — sign/verify now lock `HS256`,
   rejecting `alg:none` and algorithm-confusion tokens outright.
2. **Audit-log coverage gaps** (Medium) — seven state-changing endpoints
   (invite-accept, resend-verification, the three file-upload endpoints, and the
   two SMS delivery webhooks) wrote no `audit_logs` rows. All seven now do.
3. **Middleware-only role gating on `/api/legal/*` and `/api/officer/*`**
   (Low) — handlers now re-assert the required role via `requireRoles()`
   (`server/utils/authz.ts`) so a future middleware regression cannot silently
   expose them.

`npm audit --omit=dev` is clean (0 vulnerabilities) as of this review.

---

## 1. Disposition of prior findings

Every finding from the previous assessment, with its current status and the code
that resolves it.

| ID | Prior finding | Status | Resolved by |
|----|---------------|--------|-------------|
| C-1 | Hardcoded fallback secrets ship to production silently | **Fixed** | `server/utils/config-validation.ts` + `server/plugins/00.config-validation.ts`: production boot fails if any required secret (JWT, MinIO, IP salt, SMS webhook, PII keys) is unset, empty, or equal to the committed example value. Validates both raw `process.env` and the **resolved** `runtimeConfig` (catches the missing-`NUXT_`-prefix gap). Covered by `test/config-validation.test.ts`. |
| C-2 | `X-Forwarded-For` trusted with no proxy verification | **Fixed** | `server/utils/request-meta.ts`: forwarding headers are honored only when the socket peer matches an `ANALYTICS_TRUSTED_PROXIES` CIDR; default is empty (trust nothing, use socket IP). Covered by `test/extract-client-ip.test.ts`. Deployment note: prod **must** set the CIDR list when behind a proxy — see §3. |
| C-3 | Tokens in non-HttpOnly cookies | **Fixed** | Cookie mirror removed; `app/plugins/auth.ts` persists tokens in `localStorage` only and the server reads only `Authorization: Bearer`. XSS remains the residual risk vector (as with any SPA token store) — mitigated by templating discipline (no `v-html` on user data) and CSP (§3). |
| C-4 | `public-read` ACL on uploads; bucket policy unset | **Fixed** | `server/services/storage.service.ts`: no ACLs on `putObject`; `ensureBucket()` applies `denyAnonymousPolicy()` on every boot. Downloads go through `/api/files/[...key]` with HMAC-signed, TTL-limited URLs (`server/utils/file-url.ts`, timing-safe compare). |
| C-5 | Plaintext PII in `audit_logs` JSON | **Fixed** | `server/utils/audit.ts` scrubs values via `scrubAuditValues()` (`server/utils/pii.ts`) before persisting. National-ID columns themselves are AES-256-GCM ciphertext with per-row IVs and deterministic HMAC-SHA256 hash columns for unique lookups (`server/utils/pii-encryption.ts`, two-step migration + backfill script). Pre-fix audit rows may still hold plaintext — see §3 backlog item B-6. |
| C-6 | CSV/PDF export dumps unredacted Ghana Card numbers | **Fixed** | `server/api/analytics/declarations/export.get.ts` masks via `maskGhanaCard()` / `maskAlternateId()` (`server/utils/pii.ts`); unmasked export is explicitly deferred to a future second-factor-gated workflow. |
| H-1 | Rate limiter fails open on Redis error | **Fixed** | `server/utils/rate-limit.ts`: storage failure degrades to a conservative per-process fallback (auth 5/min, write 20/min, default 60/min) instead of allowing everything. Covered by `test/rate-limit-fallback.test.ts`. |
| H-2 | No per-account lockout; login timing leak; enumeration oracles | **Fixed** | `server/utils/auth-lockout.ts` (10 fails/15 min → 60-min lock, consulted before bcrypt); `login.post.ts` runs a dummy bcrypt compare on the user-not-found path; `check-phone.get.ts` returns `{ available: true }` for any well-formed number. Residual: `register.post.ts` still returns field-level 409s — accepted UX trade-off, bounded by auth rate limits (§3, B-4). |
| H-3 | Officer endpoints lack office scoping | **Fixed** | `server/utils/officer-scope.ts` (`assertOfficerCanActOnOffice`, `assertOfficerCanActOnDeclaration`) enforced in reviews/receipts/form-returns/form-collections; officers are bound to offices via `UserCollectionOffice`. Covered by `test/officer-scope.test.ts`. |
| H-4 | Upload validation trusts client Content-Type | **Fixed** | `server/services/storage.service.ts` `detectMagicType()`: magic-byte sniffing for JPEG/PNG/WebP/PDF, explicit rejection of text-shaped content (HTML/SVG/XML) regardless of claimed type, size caps, and the **sniffed** type is what gets stored and served. Covered by `test/upload-validation.test.ts`. |
| H-5 | No security response headers | **Fixed** | `server/middleware/01.security-headers.ts`: HSTS (prod), X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, COOP, CSP. CSP is report-only by default pending nonce work — see §3, B-1. Covered by `test/security-headers.test.ts`. |
| H-6 | MinIO over plaintext HTTP; absolute object URLs | **Fixed** | `MINIO_USE_SSL` config; upload helpers return object **keys**, and clients receive short-lived app-signed `/api/files/...` URLs rather than MinIO-direct URLs. |
| H-7 | Refresh-token replay not detected | **Fixed** | `RefreshToken.familyId` + `consumedAt`: rotation marks the old token consumed and chains in-family; presenting a consumed token wipes the family and audit-logs `REFRESH_TOKEN_REPLAY_DETECTED`. |
| H-8 | Receipt number uses `Math.random()` | **Fixed** | `server/services/pdf.service.ts` uses `crypto.randomBytes` for both halves. Covered by `test/receipt-number.test.ts`. |
| M-1 | TOCTOU on "no second active declaration" | **Fixed** | Partial unique index on `(applicant_id) WHERE status IN (active set)` + `P2002` catch in `declarations/index.post.ts`. |
| M-2 | TOCTOU on reissue-request creation | **Fixed** | Partial unique index on `(declaration_id) WHERE status='PENDING'` + `P2002` catch. |
| M-3 | SMS webhook secret defaults to empty | **Fixed** | `NOTIFICATIONS_SMS_WEBHOOK_SECRET` is in `PRODUCTION_REQUIRED_SECRETS`; production boot fails without it. Webhook handlers verify it with a timing-safe compare (`server/utils/sms-webhook.ts`). |
| M-4 | Modulo bias in 6-digit OTP | **Fixed** | Rejection-sampled `randomInt` in `send-phone-code.post.ts`; 5-attempt cap per code in `verify-phone.post.ts`. |
| M-5 | Unique codes in email subjects | **Open (backlog)** | See §3, B-3. |
| M-6 | Bucket policy not asserted at boot | **Fixed** | Folded into C-4: `ensureBucket()` applies the deny-anonymous policy on every boot. |
| M-7 | Per-user limit not route-group-aware | **Partially fixed** | `server/middleware/rate-limit-user.ts` now applies per-user caps on write/upload/verify route groups in addition to the global per-user budget. Residual tuning is operational, not structural. |
| M-8 | Seed scripts not gated against production | **Open (backlog)** | See §3, B-5. |
| M-9 | Verify-by-code endpoint rate limit | **Fixed** | Covered by the per-user `verify` route-group cap in `rate-limit-user.ts`. |
| M-10 | Audit writes best-effort and silent | **Fixed** | Durable BullMQ audit queue (`server/utils/audit-queue.ts`, drained by `server/plugins/audit-worker.ts`) with retries; persistent failures sit in the BullMQ failed-set (7 days) for operator review; inline best-effort write only as fallback. Covered by `test/audit-queue.test.ts`. |
| L-1 | Bcrypt cost factor | **Improved** | Cost is now 13 across register/login/reset/admin-create (was 12; OWASP baseline met either way). |
| L-2 | JWT lacks `iss`/`aud` | **Fixed** | `server/utils/jwt.ts` signs and verifies `issuer: "adla-auth"`, `audience: "adla"`. |
| L-3 | Registration enumeration | **Accepted** | Field-level 409s retained for UX; bounded by per-IP auth limiter and per-account lockout. Revisit if credential-stuffing pressure appears in audit logs. |
| L-4 | Email verification not required to log in | **Configurable** | `REQUIRE_EMAIL_VERIFICATION_FOR_LOGIN` gate exists in `login.post.ts` (default off); the check runs after the bcrypt compare to avoid an enumeration oracle. Decide policy before launch. |
| L-5 | Dev-friendly SSL defaults | **Documented** | `MINIO_USE_SSL`, HSTS-in-prod-only: correct dev defaults; prod values asserted via the §3 deployment checklist. |
| L-6 | GitHub Actions not SHA-pinned | **Open (backlog)** | See §3, B-7. |
| L-7 | Manual validation on some admin endpoints | **Largely fixed** | Domain schemas centralized in `server/utils/validators.ts`; remaining inline Zod usage is validated, just not via the shared helper. |
| L-8 | AI-crawler UA matching is politeness, not security | **Documented** | Cloaked-bot heuristics in `plugins/traffic.ts` are the actual control; reverse-DNS verification flags spoofed agents. |
| L-9 | Failed-login audit rows lack userId | **Accepted** | Inherent when the account doesn't exist; source IP is now trustworthy (C-2), restoring correlation value. |

---

## 2. Findings from this re-assessment

All three were **fixed on this branch**.

### R-1. JWT algorithm not pinned (Medium-Low) — fixed

`app/server/utils/jwt.ts`

Sign and verify omitted the `algorithm` option, relying on jsonwebtoken's
defaults (HS256 on sign, a permissive set on verify). While current library
versions reject `alg: "none"` when a secret is supplied, the contract was
implicit and one dependency upgrade away from drifting.

**Fix applied:** `algorithm: "HS256"` on both sign paths and
`algorithms: ["HS256"]` in the shared verify options. Any token bearing a
different `alg` header — including `none` and RS256-confusion shapes — is
rejected before signature evaluation. Regression-tested in
`test/jwt-algorithm.test.ts` (alg:none, HS512, cross-secret, and missing-claim
tokens all rejected).

### R-2. Audit-log coverage gaps on seven state-changing endpoints (Medium) — fixed

`audit_logs` is a compliance requirement for this system, and seven
state-changing endpoints wrote no rows, leaving forensic blind spots:

| Endpoint | State change that was unlogged |
|----------|-------------------------------|
| `api/auth/accept-invite.post.ts` | Marks a staff user's email verified |
| `api/auth/resend-verification.post.ts` | Invalidates + reissues email-verification tokens |
| `api/upload/ghana-card.post.ts` | Stores a national-ID image |
| `api/upload/alternate-id.post.ts` | Stores an alternate-ID image |
| `api/upload/reissue-letter.post.ts` | Stores a scanned AG/Regional-Auditor approval letter |
| `api/webhooks/sms/arkesel.post.ts` | Mutates SMS delivery status (unauthenticated, secret-gated) |
| `api/webhooks/sms/hubtel.post.ts` | Mutates SMS delivery status (unauthenticated, secret-gated) |

**Fix applied:** each endpoint now calls `createAuditLog()` with new
`AuditActions` members (`INVITE_ACCEPTED`, `VERIFICATION_RESENT`,
`GHANA_CARD_UPLOADED`, `ALTERNATE_ID_UPLOADED`, `REISSUE_LETTER_UPLOADED`,
`SMS_DELIVERY_UPDATED`). Upload logs record only the storage key and sniffed
content-type — never file bytes; webhook logs record provider, message ID, and
status with no `userId` (none exists). All values pass through the existing
`scrubAuditValues()` PII scrubber.

### R-3. `/api/legal/*` and `/api/officer/*` relied solely on middleware role gating (Low) — fixed

The role check for these prefixes lived only in `server/middleware/auth.ts`
(path-prefix matching). The handlers themselves checked only that *some*
authenticated user was present — so a future middleware regression (renamed
prefix, reordering, accidental allow-list entry) would have exposed legal-unit
PII listings to any authenticated applicant. Admin analytics endpoints already
had a defensive `requireAdmin()` re-check; legal/officer endpoints had no
equivalent.

**Fix applied:** new `requireRoles(event, roles)` helper in
`server/utils/authz.ts` (admin always passes, matching `officer-scope.ts`
semantics; 401 when unauthenticated, 403 on role mismatch). Called at the top
of all nine `/api/legal/*` handlers (`legal_unit`) and `/api/officer/stats`
(`schedule_officer`). No behavior change for legitimate callers.

---

## 3. Backlog (not launch blockers)

| # | Item | Notes |
|---|------|-------|
| B-1 | CSP is report-only and allows `'unsafe-inline'` | Nuxt's SSR hydration payload (`__NUXT__`) requires inline script today. Path: add nonces to inline scripts, then set `SECURITY_CSP_ENFORCE=true`. Also tighten `img-src` to the real MinIO/app origin and add a `report-uri` collector. |
| B-2 | `ANALYTICS_TRUSTED_PROXIES` is empty by default | Safe default (socket IP), but a prod deploy behind a load balancer **must** set the CIDR list or all clients appear as the LB address — rate limits would throttle the LB, not users. Deployment-checklist item. |
| B-3 | Unique codes / rejection reasons in email subjects (prior M-5) | Move codes out of subject lines; prefer a magic-link to view in-app. |
| B-4 | Registration field-level 409s (prior L-3) | Accepted enumeration trade-off; revisit if `USER_LOGIN_FAILED` audit volume suggests credential stuffing. |
| B-5 | Seed scripts not production-gated (prior M-8) | `prisma/seed.ts` / `seed-demo.ts` create accounts with known passwords; add a `NODE_ENV === "production"` refusal. |
| B-6 | Pre-C-5 audit rows may contain plaintext PII | The scrubber protects new rows only. Run a one-shot scrub/redact over historical `audit_logs` rows (mirroring the PII backfill pattern) or document retention-based expiry. |
| B-7 | GitHub Actions not pinned to commit SHAs (prior L-6) | Supply-chain hardening. |
| B-8 | Token storage in `localStorage` | Deliberate trade-off (no cookies ⇒ no CSRF surface; server accepts bearer header only). Residual XSS-steals-token risk is mitigated by templating discipline and will improve further with B-1 (enforced CSP). Revisit only if a BFF/cookie session architecture is ever adopted. |
| B-9 | Deactivated users / role changes persist until access-token expiry | 15-minute access tokens bound the window; refresh paths re-check `isActive`. Acceptable; a denylist would add Redis coupling for marginal gain. |

---

## 4. What's confirmed safe

Checked during this re-assessment — keep doing these.

- **No SQL injection.** All `$queryRaw` call sites bind parameters; `Prisma.raw()` is used only with hardcoded/validated identifiers (`server/api/admin/analytics/*`).
- **No XSS in email templates.** `esc()` in `server/emails/layout.ts` escapes all five HTML-significant characters and is applied uniformly.
- **No `v-html`/`innerHTML` on user-controlled data** in the Vue tree (the single `innerHTML` use is a hardcoded accessibility FOUC script in `app.vue`).
- **No SSRF** (outbound fetches target hardcoded provider URLs), **no command injection** (no `child_process`), **no path traversal** (UUID/sanitized object keys), **no open redirects**.
- **No mass assignment.** Write endpoints map validated fields explicitly; no `...body` spreads into Prisma calls.
- **IDOR checks hold.** Applicant resources verify ownership against `event.context.auth` (declarations, profile, offices, notifications); officer writes go through `officer-scope.ts`; file downloads require an HMAC-signed URL.
- **State machine integrity.** Every transition endpoint validates the current status first; concurrent-create races are closed by partial unique indexes.
- **Auth flows.** Timing-equalized login, per-account lockout, rotating refresh-token families with replay teardown, one-time hashed reset tokens, session revocation on password reset, OTPs from a CSPRNG with attempt caps.
- **Secrets hygiene.** No committed `.env`; `.env.example` placeholders are explicitly rejected in production by the startup gate; k8s manifests reference a Secret, not inline values.
- **Dependencies.** `npm audit` clean (0 vulnerabilities); core security-relevant packages (prisma, jsonwebtoken, bcryptjs, zod, minio, bullmq) current and maintained.

---

## Production deployment checklist

The startup gate enforces the first row; the rest are operator responsibilities.

1. Set real values for `JWT_SECRET`, `JWT_REFRESH_SECRET`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `ANALYTICS_IP_SALT`, `NOTIFICATIONS_SMS_WEBHOOK_SECRET`, `PII_ENCRYPTION_KEY`, `PII_HMAC_KEY` (boot fails otherwise — including on committed example values; remember the `NUXT_`-prefixed twins for runtime-overridden builds).
2. Set `ANALYTICS_TRUSTED_PROXIES` to the load balancer / ingress CIDRs (B-2).
3. Set `MINIO_USE_SSL=true` and an HTTPS MinIO endpoint.
4. Keep `REDIS_URL` configured so rate limiting, lockout, and the audit/notification queues run on shared storage (per-process fallbacks are a degraded mode, not a deployment strategy).
5. Decide the `REQUIRE_EMAIL_VERIFICATION_FOR_LOGIN` policy (L-4).
6. Plan the CSP nonce work, then flip `SECURITY_CSP_ENFORCE=true` (B-1).
7. Do not run `db:seed` / `db:seed:demo` against production (B-5, until gated).
