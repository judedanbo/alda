# Production Checklist

Pre-launch and post-deploy verification for the ADLA application. Distilled
from the eight commits' worth of hardening on the
`claude/cybersecurity-assessment-public-app-P1MS5` branch — the source-of-
truth findings are in [`security-assessment.md`](./security-assessment.md).

## 1. Required environment variables

The C-1 startup gate (`app/server/plugins/00.config-validation.ts`) refuses
to boot in production when any of these is missing or set to the committed
example value. Generate each with `openssl rand` and store in the deploy
environment's secret manager — never commit them.

| Variable | Purpose | Generate |
| --- | --- | --- |
| `JWT_SECRET` | Access-token signing key | `openssl rand -hex 64` |
| `JWT_REFRESH_SECRET` | Refresh-token signing key | `openssl rand -hex 64` |
| `MINIO_ACCESS_KEY` | Object-storage credential | `openssl rand -hex 32` |
| `MINIO_SECRET_KEY` | Object-storage credential | `openssl rand -hex 32` |
| `ANALYTICS_IP_SALT` | Pre-image salt for IP hashing | `openssl rand -hex 32` |
| `NOTIFICATIONS_SMS_WEBHOOK_SECRET` | Shared secret for SMS-provider callbacks | `openssl rand -hex 32` |
| `PII_ENCRYPTION_KEY` | AES-256-GCM key for at-rest national-ID encryption (32 raw bytes hex-encoded) | `openssl rand -hex 32` |
| `PII_HMAC_KEY` | HMAC-SHA256 key for the lookup-hash column on encrypted IDs | `openssl rand -hex 32` |

`DATABASE_URL` is also required but has no fallback — Prisma fails fast on
the first query if it's missing.

## 2. Operator-tunable environment variables

These have working defaults; tune for the deployment shape.

| Variable | Default | When to override |
| --- | --- | --- |
| `ANALYTICS_TRUSTED_PROXIES` | `""` (trust no forwarding headers) | Set to the CIDRs of your ingress / proxy / CDN edges — otherwise rate limiting buckets every request under the proxy's IP and audit-log `ipAddress` records the proxy. Example for a K8s cluster with private nets: `"10.0.0.0/8,172.16.0.0/12,fc00::/7"`. **On Nuxt-runtime (production) deploys (k8s), set the `NUXT_`-prefixed name `NUXT_ANALYTICS_TRUSTED_PROXIES`** — the plain name is read only at build time and is ignored at runtime (see the configmap naming contract). Also confirm the real client IP actually reaches the proxy: an ingress-nginx behind a cloud LoadBalancer needs `externalTrafficPolicy: Local` (or proxy-protocol) on its Service, otherwise the source IP is SNAT'd to a node IP before nginx writes `X-Forwarded-For` — every visitor then shows one identical node `10.x`. On AKS, set it with `kubectl patch svc ingress-nginx-controller -n ingress-nginx --type merge -p '{"spec":{"externalTrafficPolicy":"Local"}}'` (verify with `-o jsonpath='{.spec.externalTrafficPolicy}'`). |
| `MINIO_USE_SSL` | `false` | `true` whenever the Nuxt-to-MinIO link crosses a network segment. |
| `SECURITY_CSP_ENFORCE` | `false` (CSP ships report-only) | Flip to `true` once browser DevTools shows no CSP violations on production traffic for ~24h. |
| `REDIS_URL` | unset → in-memory analytics store | Always set in multi-instance deploys — the in-memory fallback works per-pod only and the rate limiter's local fail-closed fallback (H-1) is much tighter than the normal limits. |
| `REQUIRE_EMAIL_VERIFICATION_FOR_LOGIN` | `false` | Flip to `true` once the email-verification flow is reliable (delivery + retry). When on, `POST /api/auth/login` returns 403 for accounts with `emailVerified=false`. |
| `AUDIT_QUEUE_ENABLED` | `true` when `REDIS_URL` set | Durable audit-log writes via BullMQ (M-10). Off → inline best-effort write only. Production should never run with this off. |
| `AUDIT_WORKER_ENABLED` | `true` | Set `false` on web-only pods that shouldn't run a worker. |
| `AUDIT_WORKER_CONCURRENCY` | `2` | Audit writes are short DB inserts; bump if a worker pod is the bottleneck. |
| `AUDIT_MAX_ATTEMPTS` | `3` | Retries before the job lands in BullMQ's `failed` set. |

## 3. Deploy sequence for the PII-encryption migration

The encryption-at-rest migration (C-5 part 2) ships as two sequential
Prisma migrations bracketing a backfill step. On a fresh DB, `prisma
migrate reset` runs both and the seed writes encrypted values directly.
On a system with existing applicant profiles:

```sh
npm run db:migrate          # applies 20260526000000_pii_encryption_add_columns
npm run db:backfill:pii     # encrypts + hashes existing plaintext IDs
npm run db:migrate          # applies 20260526010000_pii_encryption_drop_plaintext
```

The backfill is idempotent — re-running it skips rows that already have a
cipher. If you forget to run it between the two migrations, the second
migration fails because the unique constraint on the new hash column
can't be backfilled from null values.

## 4. Post-deploy smoke checks

Walk these in order. Each one regression-tests a specific shipped item.

### Bucket access (C-4, M-6)

```sh
curl -I https://<minio-host>/adla-uploads/some-known-key
# expect: 403 Forbidden (was 200 before C-4)
```

### Response headers (H-5)

```sh
curl -I https://<app-host>/api/health
# expect every response carries:
#   x-frame-options: DENY
#   x-content-type-options: nosniff
#   referrer-policy: strict-origin-when-cross-origin
#   permissions-policy: camera=(), microphone=(), geolocation=(), ...
#   strict-transport-security: max-age=31536000; includeSubDomains
#   content-security-policy-report-only: default-src 'self'; ...
```

### Trusted-proxy gating (C-2)

```sh
# Without ANALYTICS_TRUSTED_PROXIES, the X-Forwarded-For below must be ignored:
curl -H "X-Forwarded-For: 9.9.9.9" https://<app-host>/api/health
# audit_logs.ipAddress for this request should be the socket peer
# (your CDN/ingress IP), not 9.9.9.9.
```

### Account lockout (H-2)

```sh
# 10 wrong-password attempts in a row → 11th returns 429 with Retry-After.
for i in $(seq 1 10); do
  curl -X POST -H 'Content-Type: application/json' \
    -d '{"email":"real-user@example.com","password":"wrong"}' \
    https://<app-host>/api/auth/login
done
# Next attempt — even with correct password — returns 429.
```

### Refresh-token replay (H-7)

```sh
# Log in, capture refreshToken. Refresh once normally (get a new pair).
# Re-submit the ORIGINAL refresh token → 401 + every refresh token for
# that user is deleted. Check audit_logs for REFRESH_TOKEN_REPLAY_DETECTED.
```

### Officer scoping (H-3)

```sh
# An officer assigned to office A trying to record a form collection at
# office B returns 403 with "You are not assigned to this collection office."
# Admins bypass.
```

### Bucket private + presigned (C-4)

Log in as an applicant and upload a Ghana Card. After 20 minutes, hard-
reload the profile page — the preview should still render (server re-signs
the URL). Copy a presigned URL from DevTools, wait 16 minutes, paste it
back — expect 403.

### Magic-byte upload rejection (H-4)

```sh
# A renamed HTML file labelled image/jpeg must be rejected at upload time.
echo '<!DOCTYPE html><script>alert(1)</script>' > /tmp/evil.jpg
curl -X POST -H "Authorization: Bearer <token>" \
  -F "file=@/tmp/evil.jpg;type=image/jpeg" -F "side=front" \
  https://<app-host>/api/upload/ghana-card
# expect: 400 "File contents don't match the declared type."
```

### Rate-limit fail-closed (H-1)

Stop the Redis container. Hit `/api/health` ~60 times — expect 429 after
the fallback cap. Restart Redis; normal limits resume.

### Verify-by-code cap (M-9)

```sh
# /api/verify/<code> is now classified separately. The IP-side cap is
# 90/min; the per-user-per-group divisor (M-7) makes the user-side
# 30/min. Hit the endpoint 31 times in one minute from a single
# authenticated officer account — expect a 429 on the 31st.
```

### Durable audit-log queue (M-10)

```sh
# 1. Tail logs on boot — expect `[audit-worker] worker started`.
# 2. Stop the audit worker process (in a deploy that runs web + worker
#    separately). Trigger an audit event (a login). The web pod returns
#    success; the job sits in `bull:audit-logs:wait`.
# 3. Restart the worker. The job drains and the row appears in
#    audit_logs with createdAt matching the original request time
#    (not the worker's wall clock).
# 4. `redis-cli LLEN bull:audit-logs:failed` should be 0 on a healthy
#    run; non-zero means the DLQ is doing its job.
```

## 5. After the smoke checks

- Enable CSP enforce mode: set `SECURITY_CSP_ENFORCE=true` and redeploy.
- Confirm `RefreshToken` rows have non-null `familyId` after the first
  user's first rotation. (Pre-deploy tokens carry null until rotated.)
- Schedule a weekly check of `audit_logs` for unexpected
  `REFRESH_TOKEN_REPLAY_DETECTED` events — these indicate either a stolen
  refresh token or a buggy client re-submitting an already-rotated token.

## 6. Not-yet-shipped items

- **L-4** — email verification is not currently a gate on authentication.
  If product requires unverified users to be blocked, file a follow-up.
- **M-10** — audit-log writes are best-effort (catch-and-log). For
  compliance-critical environments, wire writes through the existing
  BullMQ pipeline with a dead-letter queue.
- A UI for assigning schedule officers to collection offices. Today the
  initial assignment lives in the seed; ongoing changes need Prisma Studio
  or a hand-written SQL `INSERT`.
