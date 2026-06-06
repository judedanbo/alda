# Data Classification & Handling Policy — Asset Declaration Portal (ADLA)

> **Scaffold / working draft.** Defines ADLA's data classification tiers and the
> handling rules per tier. Closes SoA controls **5.12/5.13** and supports
> **8.10/8.11/8.12**. Derives from `docs/information-security-policy.md`. Data
> inventory lives in `docs/dpia.md` App.A and `docs/ropa.md`.

---

## 0. Document control

| Field | Value |
| --- | --- |
| Version | 0.1 (draft) | 
| Owner | `[TBD]` (Information Security Officer) |
| Approved by | `[TBD]` |
| Date created | 2026-06-03 |
| Review | Annually / on change. |

---

## 1. Purpose & scope

Ensure ADLA data is classified by sensitivity and handled with controls
proportionate to its classification. Applies to all data in ADLA's stores
(PostgreSQL, object storage, Redis), exports, backups, logs, and communications.

## 2. Classification tiers

| Tier | Definition | ADLA examples |
| --- | --- | --- |
| **Restricted-PII** | Highest sensitivity; unauthorized disclosure causes serious harm and/or legal breach. | National-ID (Ghana Card) numbers, Ghana Card images, authentication credentials/keys. |
| **Confidential** | Sensitive personal/operational data. | Names, contact details, declaration records & status, reviews, receipts, scanned reissue letters, contact submissions. |
| **Internal** | Non-public operational data, low harm if disclosed. | Notification metadata, pseudonymized analytics, office/institution config. |
| **Public** | Intended for public release. | Public pages (`index`, `privacy`, `terms`, `contact`), published guidance. |

## 3. Handling rules by tier

| Control | Restricted-PII | Confidential | Internal | Public |
| --- | --- | --- | --- | --- |
| Encryption at rest | **Required** — field-level (national-ID via `pii-encryption.ts`); whole-store/backup encryption for images. | Store-level encryption | Recommended | N/A |
| Encryption in transit | **Required** (TLS) | Required | Required | N/A |
| Access | Need-to-know, role-scoped, audit-logged | Role-based (RBAC) | Authenticated staff | Anyone |
| In logs/audit trail | **Never store raw** (use IDs/hashes) | Avoid; minimize | Permitted | Permitted |
| In email/SMS bodies | **Prohibited** | Minimize | Permitted | Permitted |
| In exports (CSV/PDF) | Redact/restrict; verified recipient only | Restrict to authorized staff | Permitted | Permitted |
| Object-store ACL | Private, signed-URL access only | Private | Private/Internal | Public-read allowed |
| Retention | Per statutory schedule; then secure deletion | Per retention policy | Per retention policy | N/A |
| Disposal | Secure deletion; crypto-erase where applicable | Secure deletion | Standard deletion | N/A |

## 4. Specific ADLA rules

- **No Restricted-PII in `audit_logs`, notifications, or analytics** — use user
  IDs / HMAC hashes (RR-04/RR-05; SA findings).
- **Object storage `adla-uploads` is private** — never public-read (RR-02).
- **National-ID** is encrypted + HMAC-hashed at rest; decrypt only to return to
  the verified data subject (DSAR §6) or an authorized officer.
- **Non-production environments must not contain real Restricted-PII**
  (SoA 8.33); use synthetic seed data.

## 5. Labelling

Mark exported reports/records and internal documents with their classification
`[TBD]` (e.g. footer label on generated PDFs/CSVs).

## 6. Open items

1. Apply labelling to generated exports.
2. Confirm whole-store/backup encryption for object storage.
3. Map each `DataRetentionPolicy` entry to a tier and statutory period.

---

*Working scaffold, not legal advice.*
