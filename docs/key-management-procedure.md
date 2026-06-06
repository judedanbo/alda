# Cryptographic Key & Secret Management Procedure — Asset Declaration Portal (ADLA)

> **Scaffold / working draft.** Governs the full lifecycle (generate → store →
> distribute → use → rotate → revoke → destroy) of every cryptographic key and
> secret ADLA depends on. Aligned to **ISO/IEC 27001:2022 A.8.24**, **NIST SP
> 800-57**, and the **Data Protection Act, 2012 (Act 843)** duty to secure
> personal data. Pre-filled from the ADLA codebase; `[TBD]` items need the
> ops/security owner to confirm.
>
> Companion documents: `docs/incident-response-plan.md` (§5.4 references key
> rotation), `docs/dpia.md` (risk **R11** — loss of PII key → data
> unrecoverable; **R2/R3** — PII/credential exposure), `docs/ropa.md` (TOMs T5,
> T12), `docs/production-checklist.md` (the startup gate & secret list),
> `docs/security-assessment.md` (C-1 hardcoded-fallback finding).

---

## 0. Document control

| Field | Value |
| --- | --- |
| Version | 0.1 (draft) |
| Status | Draft for review |
| Owner | `[TBD]` (Information Security Officer) |
| Approver | `[TBD]` (accountable owner / SIRO) |
| Date created | 2026-06-03 |
| Review cadence | Annually and after any key compromise or architecture change. |

---

## 1. Purpose & scope

**Purpose.** Ensure all ADLA keys/secrets are strong, kept confidential,
available when needed, rotated on schedule, and recoverable — so that PII stays
protected **and** the encryption keys protecting national-ID data are never
lost (which would make that data permanently unrecoverable).

**Scope.** Every secret consumed by `runtimeConfig` in `nuxt.config.ts` and
listed in `app/.env.example`, plus TLS certificates and infrastructure
credentials. The authoritative production-secret list and startup enforcement
live in `docs/production-checklist.md` and
`app/server/plugins/00.config-validation.ts`.

**Principles.**
- **No secrets in source control.** Committed values in `.env.example` are
  placeholder markers only; the startup gate (C-1) refuses to boot in production
  if a real secret is missing or equals the placeholder.
- **Least privilege & need-to-know** for secret access.
- **Separation of duties** — no single person should hold sole, unrecoverable
  custody of the PII encryption key.
- **Defense in depth** — store secrets in a managed secret store, not in images,
  env files committed to git, or chat/email.

---

## 2. Key & secret inventory

| ID | Secret | Purpose | Type / algorithm | Generation | Rotation impact |
| --- | --- | --- | --- | --- | --- |
| K1 | `PII_ENCRYPTION_KEY` | At-rest encryption of national-ID values (`pii-encryption.ts`) | 32-byte symmetric, **AES-256-GCM** | `openssl rand -hex 32` | **High** — rotation requires re-encrypting all encrypted rows; loss = data unrecoverable (DPIA R11). |
| K2 | `PII_HMAC_KEY` | Deterministic lookup hash for encrypted IDs | 32-byte, **HMAC-SHA256** | `openssl rand -hex 32` | **High** — rotation requires recomputing all lookup hashes; loss breaks ID lookup/uniqueness. |
| K3 | `JWT_SECRET` | Sign/verify access tokens | HMAC signing secret | `openssl rand -hex 64` | Medium — rotation invalidates outstanding access tokens (short TTL 15m). |
| K4 | `JWT_REFRESH_SECRET` | Sign/verify refresh tokens | HMAC signing secret | `openssl rand -hex 64` | Medium — rotation forces all users to re-authenticate. |
| K5 | `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | Object-storage credentials (Ghana Card images, receipts) | Access credential pair | `openssl rand -hex 32` | Medium — update app + MinIO together. |
| K6 | `ANALYTICS_IP_SALT` | Salt for IP pseudonymization (`TrafficEvent`) | Random salt | `openssl rand -hex 32` | Low — rotation makes new IP hashes non-correlatable with old (acceptable; improves privacy). |
| K7 | `NOTIFICATIONS_SMS_WEBHOOK_SECRET` | Authenticate SMS-provider delivery webhooks | Shared secret | `openssl rand -hex 32` | Low — coordinate with SMS provider. |
| K8 | `DATABASE_URL` credentials | PostgreSQL auth | DB username/password | Per DB policy | Medium — coordinate with DB; brief connection cutover. |
| K9 | `SMTP_USER` / `SMTP_PASS` | Email-provider credentials | Provider credential | Per provider | Low — update on rotation. |
| K10 | `REDIS_URL` credentials (if auth'd) | Redis/queue auth | Connection secret | Per infra | Low–Medium. |
| K11 | TLS certificates (public endpoint, MinIO if `MINIO_USE_SSL`) | Encryption in transit | X.509 / TLS | CA-issued / ACME | Medium — renew before expiry; automate where possible. |

> **Sensitivity tiers:** K1, K2 are **the crown jewels** — they protect
> Restricted-PII and have catastrophic loss consequences. K3–K5, K8 are
> high-value. Treat accordingly in §3–§8.

---

## 3. Generation

- Generate keys with a CSPRNG only: `openssl rand -hex <n>` (lengths per §2) or
  the secret store's native generator. Never hand-craft, reuse across
  environments, or derive from predictable input.
- Generate **distinct** secrets per environment (dev / staging / production).
  Production secrets must never have been exposed in dev or git.
- Record generation (date, generator, who, environment) in the **key register**
  (§9) — **never record the secret value itself there**.

---

## 4. Storage & custody

| Requirement | Detail |
| --- | --- |
| Production store | `[TBD]` — a managed secret manager (e.g. cloud KMS/Secrets Manager, HashiCorp Vault, sealed K8s secrets). Injected as env vars at deploy/runtime. |
| Never | In git, container images, logs, error messages, chat, email, or shared docs. |
| Access control | Least privilege; only the deploy pipeline and named custodians. Access is logged/auditable. |
| K1/K2 custody | **Split knowledge / dual control** `[TBD]` — no single individual holds the sole copy; document the custodians. |
| Encryption at rest | Secret store encrypts secrets at rest; TLS in transit to it. |
| Separation | Production secrets isolated from non-production access paths. |

---

## 5. Distribution & use

- Secrets reach the app **only** via `runtimeConfig` / env injection at runtime;
  handlers read them via `useRuntimeConfig()`, never `process.env` directly
  (per `CLAUDE.md`).
- The **startup gate** (`00.config-validation.ts`) fails the boot in production
  if any required secret (K1–K7 set) is missing or equals its committed
  placeholder — this is the enforcement point; keep it in sync when adding
  secrets.
- No secret is transmitted to clients or placed under `runtimeConfig.public`.
- Service-to-service links carrying secrets/PII use TLS (`MINIO_USE_SSL=true`
  off-host).

---

## 6. Rotation

| Scope | Cadence (recommended `[TBD]`) | Procedure summary |
| --- | --- | --- |
| Scheduled rotation | K3/K4/K5/K6/K7: at least annually; K8/K9/K10: per infra policy; TLS (K11): before expiry. | Generate new secret in store → deploy → verify → retire old. |
| Emergency rotation | Immediately on suspected compromise (see IR plan §5.4). | Rotate the affected secret(s); for tokens, also wipe refresh-token families. |

**Key-specific rotation notes (critical):**

- **K1 `PII_ENCRYPTION_KEY` (AES-256-GCM):** Rotation is **not** a simple
  swap — every encrypted national-ID row must be **re-encrypted** under the new
  key. **`[TBD]`: implement key-versioning** (store a key id/version alongside
  each ciphertext and support decrypt-old/encrypt-new) **before** the first
  rotation, then run a re-encryption backfill (model the C-5 two-step migration +
  `db:backfill:pii` pattern). Until versioning exists, treat K1 rotation as a
  planned, all-rows migration with downtime/dual-read.
- **K2 `PII_HMAC_KEY`:** Rotation requires **recomputing every lookup hash**
  (the unique-index column). Plan as a backfill identical in shape to K1; the two
  are typically rotated together.
- **K3 `JWT_SECRET`:** Short access-token TTL (15m) means impact is brief;
  consider supporting two valid keys during a short overlap to avoid mass 401s.
- **K4 `JWT_REFRESH_SECRET`:** Rotation invalidates all refresh tokens → users
  re-authenticate. Schedule for low-traffic windows.
- **K5 MinIO creds:** Update MinIO and the app together; verify image/receipt
  read+write after cutover (post-deploy smoke check in `production-checklist.md`).
- **K6 IP salt:** New salt intentionally breaks correlation with old hashes — no
  backfill; acceptable and privacy-positive.

---

## 7. Revocation & compromise response

- On suspected/confirmed compromise, follow `docs/incident-response-plan.md`:
  contain → **emergency-rotate** the affected secret(s) → eradicate root cause →
  recover → review.
- For credential/token compromise, also **wipe the affected refresh-token
  family** and force re-authentication (the app audit-logs replay as
  `REFRESH_TOKEN_REPLAY_DETECTED`).
- If **K1/K2** are suspected compromised: rotate per §6 **and** assess this as a
  potential personal-data breach (DPO notifiability decision, IR plan §6) —
  exposure of the PII key implies exposure risk to national-ID data.
- Revoke the old secret in the store after confirming the new one is live.

---

## 8. Backup, escrow & destruction

| Item | Requirement |
| --- | --- |
| **K1/K2 backup (escrow)** | **Mandatory** — back up the PII keys to a separate, access-controlled, encrypted location so a lost secret-store entry never strands national-ID data (DPIA R11). Document custodians and recovery steps. `[TBD]` |
| Backup encryption | Key backups themselves are encrypted and access-logged. |
| Recovery test | Periodically test that K1/K2 can be recovered from escrow `[TBD]`. |
| Destruction | On retirement, securely destroy old key material after confirming no data still depends on it (for K1/K2: only after re-encryption completes). Record destruction in the register. |
| Coordination with data backups | Restoring a DB/object-store backup must use the key version that encrypted it — retain retired K1 versions for as long as any backup encrypted under them is retained. |

---

## 9. Key register (metadata only — never the secret value)

| Key ID | Purpose | Environment | Created | Custodian(s) | Store location | Last rotated | Next rotation | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| K1 | PII encryption | prod | | | | | | active |
| K2 | PII HMAC | prod | | | | | | active |
| K3 | JWT access | prod | | | | | | active |
| K4 | JWT refresh | prod | | | | | | active |
| K5 | MinIO creds | prod | | | | | | active |
| K6 | IP salt | prod | | | | | | active |
| K7 | SMS webhook | prod | | | | | | active |
| K8 | DB creds | prod | | | | | | active |
| K9 | SMTP creds | prod | | | | | | active |
| K10 | Redis creds | prod | | | | | | active |
| K11 | TLS cert(s) | prod | | | | | | active |

---

## 10. Roles & responsibilities

| Role | Responsibility |
| --- | --- |
| ISO (owner) | Owns this procedure; approves rotations; maintains the key register. |
| DevOps/Infra | Operates the secret store; performs rotation/deploy; manages TLS. |
| K1/K2 custodians (dual control) | Hold/recover the PII key material under split knowledge. `[TBD]` |
| DPO | Advises on breach notifiability if a PII key is exposed. |
| Developers | Consume secrets only via `runtimeConfig`; never log/commit them; extend the startup gate when adding secrets. |

---

## 11. Open items to finalize

1. Choose and name the production **secret store** (§4).
2. **Implement K1 key-versioning** before any PII-key rotation, then a tested
   re-encryption backfill (mirrors the C-5 migration pattern).
3. Stand up **K1/K2 escrow + recovery test** (closes DPIA R11).
4. Assign **dual-control custodians** for K1/K2.
5. Set concrete **rotation cadences** and calendar them.
6. Automate **TLS renewal** and expiry alerting.
7. Cross-link this procedure from the IR plan's §5.4 rotation steps.

---

*Working scaffold, not legal advice. Validate key strengths, rotation cadence,
escrow, and custody arrangements with your security and operations leadership.*
