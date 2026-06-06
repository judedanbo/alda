# Cryptography Policy — Asset Declaration Portal (ADLA)

> **Scaffold / working draft.** Defines approved cryptographic algorithms and
> usage standards for ADLA. Closes SoA control **8.24**; the key **lifecycle**
> (generation/storage/rotation/escrow) lives in
> `docs/key-management-procedure.md` (KMP). Derives from
> `docs/information-security-policy.md`.

---

## 0. Document control

| Field | Value |
| --- | --- |
| Version | 0.1 (draft) |
| Owner | `[TBD]` (Information Security Officer) |
| Approved by | `[TBD]` |
| Date created | 2026-06-03 |
| Review | Annually / on cryptographic-standard change. |

---

## 1. Purpose & scope

Ensure cryptography is used correctly and consistently to protect the
confidentiality and integrity of ADLA data, using current, non-deprecated
algorithms. Scope: data at rest, data in transit, authentication tokens,
hashing, and random-value generation.

## 2. Approved algorithms (as implemented + standard)

| Use | Standard | ADLA implementation |
| --- | --- | --- |
| PII encryption at rest | **AES-256-GCM** (authenticated) | `server/utils/pii-encryption.ts` (national-ID) |
| Deterministic lookup hash | **HMAC-SHA256** | PII HMAC column |
| Password hashing | **bcrypt** (adaptive) `[TBD: cost factor]` | login/registration |
| Token signing | HMAC-signed JWT (HS256+) | `server/utils/jwt.ts` |
| Transport encryption | **TLS 1.2+ (prefer 1.3)** | HTTPS edge; `MINIO_USE_SSL` off-host |
| Random values / salts / codes | CSPRNG | `code-generator.ts`, `ANALYTICS_IP_SALT` |
| General hashing (non-secret) | SHA-256+ | analytics IP hashing (salted) |

## 3. Prohibited / deprecated

- MD5, SHA-1 for security purposes; DES/3DES/RC4; ECB mode; unauthenticated
  encryption where integrity matters; TLS < 1.2; unsalted fast hashes for
  passwords; hardcoded/predictable keys or IVs.

## 4. Usage rules

- **Authenticated encryption** (GCM) for confidentiality+integrity of stored PII.
- **Unique IV/nonce per encryption operation**; never reuse a nonce under the
  same key.
- **Separate keys per purpose** (encryption vs HMAC vs JWT access vs refresh) —
  see KMP §2.
- **Keys are 256-bit / 32-byte** for symmetric use; JWT secrets ≥ 64 hex chars.
- Cryptographic material is **never logged, committed, or exposed to clients**
  (enforced by the startup gate; SA C-1).
- TLS terminates at a trusted edge; service-to-service links carrying PII use TLS.

## 5. Key lifecycle

Governed entirely by `docs/key-management-procedure.md` (generation, storage,
distribution, rotation, revocation, escrow, destruction). Note that rotating the
PII encryption/HMAC keys requires re-encryption/re-hash backfills (KMP §6).

## 6. Open items

1. Confirm and record the **bcrypt cost factor** and **JWT algorithm**.
2. Enforce **TLS 1.2+** (disable older protocols) at the edge and to MinIO.
3. Cross-check no deprecated primitives remain in dependencies (SCA).

---

*Working scaffold, not legal advice.*
