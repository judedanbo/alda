# Records of Processing Activities (RoPA) — Asset Declaration Portal (ADLA)

> **Scaffold / working draft.** A controller's record of processing activities,
> structured to satisfy **Data Protection Act, 2012 (Act 843)** accountability
> expectations (and aligned to the GDPR Art. 30 record model auditors commonly
> use). Pre-filled from the ADLA codebase; `[TBD]` items need the data
> controller / Data Protection Supervisor to confirm.
>
> Companion documents: `docs/dpia.md` (shares the data inventory),
> `docs/audit-documentation-checklist.md`, `docs/security-assessment.md`.

---

## 0. Document control

| Field | Value |
| --- | --- |
| Version | 0.1 (draft) |
| Status | Draft for review |
| Author | `[TBD]` |
| Owner (DPO / Data Protection Supervisor) | `[TBD]` |
| Date created | 2026-06-03 |
| Next review | On any new/changed processing activity, or `[TBD]` (e.g. annually) |

---

## 1. Controller, processor & DPO identification

| Field | Value |
| --- | --- |
| Data controller (legal entity) | `[TBD]` (e.g. the operating Ministry / Audit Service / Office of the Auditor-General) |
| Controller address & contact | `[TBD]` |
| Joint controller(s), if any | `[TBD]` |
| Data Protection Officer / Supervisor | `[TBD]` — name, email, phone |
| DPC controller registration no. | `[TBD]` (Act 843 registration) |
| Representative (if controller is offshore) | `[TBD]` / N/A |

---

## 2. How to read this record

Each **processing activity** below records, per Act 843 / Art. 30(1):

- **(a) Purpose(s)** of the processing
- **Lawful basis** (Act 843)
- **(b) Categories of data subjects**
- **(c) Categories of personal data** (incl. special/sensitive)
- **(d) Categories of recipients** (incl. processors)
- **(e) International transfers** + safeguard
- **(f) Retention period** (erasure time limits)
- **(g) General description of technical & organizational security measures** (TOMs)

The reusable cross-cutting security measures (TOMs) are listed once in §13 and
referenced by each activity to avoid repetition. The field-level **data
inventory** lives in `docs/dpia.md` Appendix A.

---

## 3. PA-01 — Applicant registration & account management

| Element | Detail |
| --- | --- |
| Purpose | Create and manage applicant accounts to access the declaration portal. |
| Lawful basis | `[TBD]` — performance of a public task / legal obligation (Article 286(5)); account credentials necessary to deliver it. |
| Data subjects | Applicants (public officers); staff users. |
| Personal data | Name, email, phone, password (bcrypt hash), email/phone verification tokens, account role(s). Models: `User`, `Role`, `UserRole`, `EmailVerificationToken`, `PhoneVerificationToken`, `PasswordResetToken`, `RefreshToken`. |
| Special category | None. |
| Recipients | Internal admins; email/SMS processors for verification messages. |
| Transfers | `[TBD]` (depends on email/SMS/hosting location). |
| Retention | Account lifetime + `[TBD]` after closure; tokens expire short-term; consumed refresh tokens retained for replay detection. |
| Security measures (TOMs) | T1, T2, T3, T4, T7, T9 (§13). |

---

## 4. PA-02 — Identity verification (Ghana Card)

| Element | Detail |
| --- | --- |
| Purpose | Verify applicant identity to ensure declaration integrity. |
| Lawful basis | `[TBD]` — legal obligation / public task; identity verification necessary for the statutory purpose. |
| Data subjects | Applicants. |
| Personal data | **National ID (Ghana Card) number** (encrypted + HMAC hash), **Ghana Card image(s)**, alternate ID type/reason. Models: `ApplicantProfile`, `IdDocumentType`, `AlternateIdReason`; images in object storage. |
| Special category | High-sensitivity national identifier + identity-document image (photograph). |
| Recipients | Authorized Schedule Officers / Legal Unit / Admin (scoped); object-storage processor. |
| Transfers | `[TBD]` (object-storage/hosting location). |
| Retention | Per statutory retention `[TBD]`; subject to `DataRetentionPolicy` / archival. |
| Security measures (TOMs) | T1, T2, T3, T4, T5, T6, T8, T9 (§13). |

---

## 5. PA-03 — Asset declaration lifecycle (workflow)

| Element | Detail |
| --- | --- |
| Purpose | Operate the declaration state machine (`CODE_GENERATED → … → COMPLETED`) — code generation, form collection, submission, review, sealing, completion. |
| Lawful basis | Legal obligation / public task (Article 286(5)). |
| Data subjects | Applicants. |
| Personal data | Declaration records, unique codes, status history, office/category linkage. Models: `Declaration`, `DeclarationStatusHistory`, `ApplicantOffice`, `PublicOfficeCategory`, `Institution`. |
| Special category | None directly (declaration content sensitivity is `[TBD]` per business rules). |
| Recipients | Schedule Officers / Legal Unit / Admin (role- and office-scoped); Audit Service. |
| Transfers | `[TBD]`. |
| Retention | Statutory `[TBD]` (declarations likely long-retention compliance records). |
| Security measures (TOMs) | T2, T3, T4, T9, T10 (§13). |

---

## 6. PA-04 — Form collection & lost-form reissue

| Element | Detail |
| --- | --- |
| Purpose | Record physical form collection from a `CollectionOffice`; process tracked lost-form reissue requests and offline approvals. |
| Lawful basis | Legal obligation / public task. |
| Data subjects | Applicants. |
| Personal data | Collection records, reissue requests/decisions, scanned approval letters, approver identity. Models: `FormCollection`, `FormReissueRequest`, `CollectionOffice`, `UserCollectionOffice`; scanned letters in object storage. |
| Special category | None. |
| Recipients | Schedule Officers (office-scoped), Legal Unit, Admin; object-storage processor. |
| Transfers | `[TBD]`. |
| Retention | Statutory `[TBD]`. |
| Security measures (TOMs) | T2, T3, T4, T6, T9, T10 (§13). |

---

## 7. PA-05 — Review, sealing & receipting

| Element | Detail |
| --- | --- |
| Purpose | Officer/Legal review of declarations and generation of receipts as proof of submission. |
| Lawful basis | Legal obligation / public task. |
| Data subjects | Applicants. |
| Personal data | Review records, section reviews, receipts (PDF). Models: `Review`, `DeclarationSectionReview`, `Receipt`; receipt PDFs in object storage. |
| Special category | None. |
| Recipients | Applicant (receipt), reviewing staff, object-storage processor. |
| Transfers | `[TBD]`. |
| Retention | Statutory `[TBD]`. |
| Security measures (TOMs) | T2, T3, T4, T6, T9 (§13). |

---

## 8. PA-06 — Notifications (email & SMS)

| Element | Detail |
| --- | --- |
| Purpose | Notify applicants of workflow events, verification, and security actions. |
| Lawful basis | Legal obligation / public task (transactional); not marketing. |
| Data subjects | Applicants; staff users. |
| Personal data | Email, phone, message content, delivery metadata, preferences. Models: `Notification`, `NotificationPreference`, `NotificationTypePreference`, `NotificationDeliveryLog`. |
| Special category | None — **policy: no Restricted-PII (Ghana Card no.) in message bodies**. |
| Recipients | Email/SMTP processor; SMS gateway processor. |
| Transfers | `[TBD]` (provider location). |
| Retention | `NOTIFICATIONS_READ_RETENTION_DAYS` (90) / `NOTIFICATIONS_UNREAD_RETENTION_DAYS` (180); delivery logs `[TBD]`. |
| Security measures (TOMs) | T2, T3, T7, T9, T11 (§13). |

---

## 9. PA-07 — Audit logging & accountability

| Element | Detail |
| --- | --- |
| Purpose | Record state transitions and security-relevant events for compliance and accountability. |
| Lawful basis | Legal obligation (accountability under Act 843; compliance audit). |
| Data subjects | Applicants; staff users. |
| Personal data | Actor user ID, action, entity references, timestamps, IP. Model: `AuditLog`. **Policy: no raw Ghana Card numbers/names in audit records** (tracked finding). |
| Special category | None (by policy). |
| Recipients | Admins; auditors. |
| Transfers | `[TBD]`. |
| Retention | `[TBD]` — set to meet audit/compliance needs; protect from tampering. |
| Security measures (TOMs) | T2, T3, T4, T10, T12 (§13). |

---

## 10. PA-08 — Web analytics, abuse detection & security

| Element | Detail |
| --- | --- |
| Purpose | Traffic analytics, abuse/bot detection, rate limiting and security enforcement. |
| Lawful basis | `[TBD]` — legitimate interest / public task in securing the service; DNT honoured. |
| Data subjects | Website visitors; applicants; staff. |
| Personal data | **Hashed** IP (salted), user-agent, session/visitor classification, abuse/enforcement events. Models: `TrafficEvent`, `TrafficRollupHourly/Daily`, `AbuseEvent`, `EnforcementAction`, `ActorAccessRule`. |
| Special category | None; IPs pseudonymized via `ANALYTICS_IP_SALT`. |
| Recipients | Internal security/ops. |
| Transfers | `[TBD]`. |
| Retention | Raw events pruned per retention config; rollups aggregated. |
| Security measures (TOMs) | T2, T3, T8, T9 (§13). |
| Automated decision-making | Abuse scoring may rate-limit/block traffic; **not determinative of any declaration outcome**. Confirm `[TBD]`. |

---

## 11. PA-09 — Contact / correspondence submissions

| Element | Detail |
| --- | --- |
| Purpose | Receive and handle public enquiries/contact submissions. |
| Lawful basis | `[TBD]` — public task / legitimate interest in responding. |
| Data subjects | Members of the public; applicants. |
| Personal data | Name, contact details, message, category/status. Model: `ContactSubmission` (`ContactCategory`, `ContactStatus`). |
| Special category | Possible if volunteered in free text — minimize/avoid. |
| Recipients | Internal staff handling enquiries. |
| Transfers | `[TBD]`. |
| Retention | `[TBD]`. |
| Security measures (TOMs) | T2, T3, T9 (§13). |

---

## 12. PA-10 — Data retention, archival & disposal

| Element | Detail |
| --- | --- |
| Purpose | Enforce storage-limitation: archive and delete records per retention policy. |
| Lawful basis | Legal obligation (storage limitation; statutory retention). |
| Data subjects | All above. |
| Personal data | Retention rules + archived records. Models: `DataRetentionPolicy`, `ArchivedRecord`; scheduled prune tasks. |
| Special category | Inherits from archived content. |
| Recipients | Internal admins. |
| Transfers | `[TBD]`. |
| Retention | Defines retention for the others; statutory periods `[TBD]`. |
| Security measures (TOMs) | T2, T3, T4, T9 (§13). |

---

## 13. Technical & organizational security measures (TOMs) — reusable register

> General description per Act 843 accountability. Detailed evidence lives in
> `docs/security-assessment.md` and `docs/production-checklist.md`.

| Ref | Measure |
| --- | --- |
| T1 | Strong credential storage — bcrypt password hashing; constant-time user-not-found path. |
| T2 | Encryption in transit — TLS/HTTPS for client traffic and service-to-service links (`MINIO_USE_SSL`). |
| T3 | Access control — JWT auth, RBAC role prefixes, server + client enforcement; least privilege. |
| T4 | Authorization scoping — Schedule Officers scoped to assigned `CollectionOffice`(s); IDOR checks on declaration access. |
| T5 | Encryption at rest for PII — AES-256-GCM field encryption of national-ID + HMAC lookup hash (`pii-encryption.ts`). |
| T6 | Object-storage protection — private buckets, randomized filenames, no public-read ACL, scoped access. |
| T7 | Account-takeover defenses — per-account lockout, refresh-token rotation with family/replay detection, secure cookie flags. |
| T8 | Pseudonymization — salted IP hashing for analytics; DNT honoured. |
| T9 | Network/abuse controls — layered rate limiting (IP, route-group, per-user), trusted-proxy handling, security headers/CSP. |
| T10 | Audit logging — durable, queue-backed audit trail of state transitions and security events. |
| T11 | Data minimization in comms — no Restricted-PII in email/SMS bodies. |
| T12 | Secrets governance — production startup gate rejects missing/placeholder secrets; secrets held in a secret manager. |
| T13 (org) | Organizational — staff vetting, confidentiality/NDA, security-awareness training, access reviews, change management. `[TBD]` |

---

## 14. Open items to finalize the RoPA

1. Confirm the **legal controller entity**, DPO details, and **DPC registration number**.
2. Confirm the **lawful basis** per activity (recommended: legal obligation / public task).
3. Set **statutory retention periods** for declarations, IDs, images, audit logs, notifications, analytics, contact data.
4. Determine **international transfers** (hosting, SMS, email processors) and safeguards.
5. List named **processors** and attach DPAs (links to vendor register).
6. Confirm **abuse-scoring is non-determinative** of individual declaration outcomes.
7. Populate organizational TOMs (T13) once HR/awareness policies exist.

---

*Working scaffold, not legal advice. Validate categories, bases, retention and
transfers with the Data Protection Officer and the Data Protection Commission.*
