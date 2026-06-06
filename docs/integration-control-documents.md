# Integration / Interface Control Documents (ICD) — Asset Declaration Portal (ADLA)

> Closes audit-checklist item **D6**. One control document per external system
> ADLA integrates with: protocol/endpoint, authentication, data exchanged (with
> sensitivity), direction, failure handling, and controlling configuration.
> Architecture context: [`architecture.md`](./architecture.md); secrets &
> lifecycle: [`key-management-procedure.md`](./key-management-procedure.md);
> processor data-protection: [`ropa.md`](./ropa.md) §Appendix C.

**Document control:** Version 0.1 (draft) · Owner `[TBD]` (ISO / Engineering
lead) · Reviewed 2026-06-03 · Update when an external interface changes.

All credentials are injected via `runtimeConfig` (`nuxt.config.ts`) from the
secret store; the startup gate (`00.config-validation.ts`) blocks boot in
production if a required secret is missing or a placeholder.

---

## ICD-1 — PostgreSQL (primary datastore)

| Attribute | Detail |
| --- | --- |
| Client | Prisma ORM (`@prisma/client`), singleton (`app/server/utils/prisma.ts`) |
| Protocol | PostgreSQL wire protocol over TCP |
| Endpoint / config | `DATABASE_URL` |
| Auth | DB username/password in the connection string (secret) |
| Direction | App ⇄ DB (read/write) |
| Data exchanged | All structured data incl. **Restricted-PII** (encrypted national-ID), Confidential workflow data, audit logs |
| Encryption | TLS in transit `[TBD: enforce sslmode=require]`; national-ID encrypted at field level before write |
| Failure handling | Prisma fails fast on connection loss; queries surface 5xx; no fail-open |
| Notes | snake_case columns via `@map`/`@@map`; migrations via `prisma migrate` |

## ICD-2 — Redis / BullMQ (cache, queues, pub/sub)

| Attribute | Detail |
| --- | --- |
| Client | `ioredis` singleton (`app/server/utils/redis.ts`) + BullMQ |
| Protocol | RESP over TCP |
| Endpoint / config | `REDIS_URL` (optional — falls back to in-memory, single-instance only) |
| Auth | Connection secret if the instance requires AUTH/TLS `[TBD]` |
| Direction | App ⇄ Redis |
| Uses | BullMQ queues **`notifications-email`**, **`notifications-sms`**, **`audit-logs`**; pub/sub for the SSE notification stream; analytics KV (rate-limit counters, traffic buffer, AI IP-range cache) |
| Data exchanged | Job payloads (notification/audit), counters; **no Restricted-PII in job bodies** |
| Failure handling | Queues degrade to inline/best-effort writes; rate limiter falls back to a conservative per-process cap (does **not** fail open); failed jobs retained 7 days in BullMQ's failed-set |
| Config | `*_QUEUE_ENABLED`, `*_WORKER_ENABLED`, concurrency, `*_MAX_ATTEMPTS` (exponential backoff) |

## ICD-3 — MinIO / S3-compatible object storage

| Attribute | Detail |
| --- | --- |
| Client | MinIO SDK (`app/server/services/storage.service.ts`) |
| Protocol | S3 HTTP API; **TLS when `MINIO_USE_SSL=true`** (required off-host) |
| Endpoint / config | `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_USE_SSL`, `MINIO_BUCKET` (`adla-uploads`) |
| Auth | `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` (secrets) |
| Direction | App ⇄ object storage (put/get) |
| Data exchanged | **Restricted-PII**: Ghana Card / alternate-ID images, scanned reissue letters, receipt PDFs |
| Access control | **Deny-anonymous** bucket policy (asserted on boot); objects written with randomized keys; downloads only via **presigned URLs (15-min TTL)** |
| Failure handling | Upload/get errors surface as 5xx to the caller; no public fallback |
| Post-deploy check | `curl` a known key must return 403 (see `production-checklist.md`) |

## ICD-4 — SMTP / email

| Attribute | Detail |
| --- | --- |
| Client | Nodemailer (`app/server/services/email.service.ts`); templates in `app/server/emails/` |
| Protocol | SMTP (+STARTTLS/SMTPS per provider) |
| Endpoint / config | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` |
| Auth | SMTP username/password (secret) |
| Direction | App/worker → SMTP (outbound) |
| Data exchanged | Recipient email + message content (verification links, workflow notices). **Policy: no Restricted-PII (e.g. national-ID) in bodies/subjects** — e.g. the unique code is kept out of the subject |
| Failure handling | Dispatched via the `notifications-email` queue with retries; delivery recorded in `NotificationDeliveryLog`; inline fallback when queue off |
| Dev | MailHog sink (`localhost:1025`) |

## ICD-5 — SMS gateways (Hubtel / Arkesel / Twilio)

| Attribute | Detail |
| --- | --- |
| Client | `app/server/services/sms.service.ts` |
| Routing | **Ghana (+233)** → Hubtel or Arkesel (`SMS_PROVIDER`); **international** → Twilio. Numbers normalized to E.164 |
| Protocol | Provider HTTPS REST APIs |
| Endpoint / config | Hubtel: `HUBTEL_CLIENT_ID/SECRET`; Arkesel: `ARKESEL_API_KEY`; Twilio: `TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM_NUMBER`; sender id |
| Auth | Provider API credentials (secrets) |
| Direction | App/worker → provider (outbound send) |
| Data exchanged | Recipient phone + message text (OTPs, workflow notices). **No Restricted-PII in bodies** |
| Failure handling | `notifications-sms` queue with retries; `NotificationDeliveryLog`; dev = mock success when creds blank |

### ICD-5b — Inbound SMS delivery webhooks

| Attribute | Detail |
| --- | --- |
| Endpoints | `POST /api/webhooks/sms/hubtel`, `POST /api/webhooks/sms/arkesel` |
| Direction | Provider → App (inbound, internet-facing via the proxy) |
| Auth | Shared secret `NOTIFICATIONS_SMS_WEBHOOK_SECRET`, verified with a **timing-safe** comparison (`sms-webhook.ts`). Without the secret set, endpoints accept any caller (dev-friendly) — **must be set in production** |
| Data exchanged | Provider delivery status → updates the matching `NotificationDeliveryLog` |
| Failure handling | Invalid/missing secret rejected; unknown message ids ignored |

## ICD-6 — Reverse proxy / ingress (edge)

| Attribute | Detail |
| --- | --- |
| Role | TLS termination; forwards to web pods; sets `X-Forwarded-For` |
| Trust | App trusts `X-Forwarded-For` **only** from socket peers in `ANALYTICS_TRUSTED_PROXIES` (CIDRs); otherwise uses the socket peer (`request-meta.ts`) |
| Direction | Internet → proxy → app (inbound) |
| Config | `ANALYTICS_TRUSTED_PROXIES`; HSTS emitted by `01.security-headers.ts` |
| Failure handling | Misconfiguration degrades IP attribution (rate-limit buckets under the proxy IP) — set CIDRs correctly in production |

---

## Summary — interface controls

| ICD | System | Direction | Sensitivity of data | Transport security |
| --- | --- | --- | --- | --- |
| 1 | PostgreSQL | ⇄ | Restricted-PII (encrypted) + Confidential | TLS `[TBD enforce]` |
| 2 | Redis / BullMQ | ⇄ | Internal (no Restricted-PII) | TLS `[TBD if remote]` |
| 3 | MinIO | ⇄ | **Restricted-PII** (images, receipts) | TLS if `MINIO_USE_SSL` |
| 4 | SMTP | → out | Confidential (contact + content) | STARTTLS/SMTPS |
| 5 | SMS gateways | → out | Confidential | HTTPS |
| 5b | SMS webhooks | ← in | Internal (delivery status) | HTTPS + shared secret |
| 6 | Reverse proxy | ← in | All | TLS (public edge) |

**Open items**: enforce DB TLS (`sslmode=require`); confirm Redis AUTH/TLS for
remote instances; ensure `NOTIFICATIONS_SMS_WEBHOOK_SECRET` and
`MINIO_USE_SSL=true` are set in production; sign DPAs with each external
processor (ROPA C9 / L3).

*Derived from `app/server/services/*`, `app/server/utils/{redis,prisma,request-meta,sms-webhook}.ts`,
`nuxt.config.ts`, and `app/.env.example`.*
