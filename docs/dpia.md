# Data Protection Impact Assessment (DPIA) — Asset Declaration Portal (ADLA)

> **Scaffold / working draft.** Pre-filled from the ADLA codebase and
> architecture. Items marked `[TBD]` require input from the data controller,
> the Data Protection Supervisor/Officer, and the hosting/operations owner.
> Conducted in line with the **Data Protection Act, 2012 (Act 843)** and the
> Data Protection Commission's expectations, with methodology aligned to
> ISO/IEC 29134 and the ICO DPIA template.

---

## 0. Document control

| Field | Value |
| --- | --- |
| Document title | DPIA — Asset Declaration Portal (ADLA) |
| Version | 0.1 (draft) |
| Status | Draft for review |
| Author | `[TBD]` |
| Data Protection Officer / Supervisor | `[TBD]` |
| Senior Information Risk Owner (SIRO) / accountable owner | `[TBD]` |
| Date created | 2026-06-03 |
| Date of last review | 2026-06-03 |
| Next review due | On any material processing change, or `[TBD]` (e.g. annually) |
| Related documents | `docs/audit-documentation-checklist.md`, `docs/security-assessment.md`, `docs/production-checklist.md`, `plans/asset-declaration-app.md` |

### Approval & sign-off

| Role | Name | Decision (approve / approve w/ conditions / reject) | Date | Signature |
| --- | --- | --- | --- | --- |
| DPO / Data Protection Supervisor | `[TBD]` | | | |
| System/Business owner | `[TBD]` | | | |
| Information Security Officer | `[TBD]` | | | |
| Accountable owner (SIRO) | `[TBD]` | | | |

---

## 1. Step 1 — Identify the need for a DPIA (screening)

A DPIA is **required**. The processing meets multiple high-risk triggers:

- **Large-scale processing** of personal data about the public.
- **Sensitive / special-category-adjacent data**: national identity (Ghana Card)
  numbers and **Ghana Card images** (identity documents containing photograph
  and biometric-adjacent identifiers).
- **Data concerning a statutory legal obligation** affecting individuals'
  rights (public-office asset declarations under **Article 286(5)** of the 1992
  Constitution).
- **Systematic monitoring** components (web analytics, abuse detection,
  traffic/IP processing).
- **Public-facing internet system** handling identity documents.

**Conclusion:** Full DPIA proceeds.

---

## 2. Step 2 — Describe the processing

### 2.1 Nature of the processing

ADLA is a Nuxt 4 web application (frontend + Nitro server) that digitizes the
asset-declaration workflow. Personal data is:

- **Collected** via applicant self-registration and profile completion,
  including upload of Ghana Card images.
- **Stored** in PostgreSQL (structured data) and MinIO/S3-compatible object
  storage (uploaded images, generated receipt PDFs).
- **Processed** through a state-machine workflow operated by Schedule Officers,
  the Legal Unit, and Admins.
- **Transmitted** to applicants via email/SMS notifications.
- **Exported** as CSV/PDF (receipts, reports) by authorized staff.
- **Retained / archived / deleted** per retention policy
  (`DataRetentionPolicy`, `ArchivedRecord`, scheduled prune tasks).

Key technical safeguards already implemented (see `security-assessment.md` /
`production-checklist.md`):

- Field-level **encryption of national-ID** values (AES-256-GCM) plus an HMAC
  lookup hash (`server/utils/pii-encryption.ts`).
- **RBAC** with role prefixes and **officer-to-office scoping**
  (`UserCollectionOffice`).
- **Audit logging** of state transitions (`audit_logs`, durable BullMQ writes).
- **Secret startup gate**, layered **rate limiting**, **security headers/CSP**,
  refresh-token rotation with replay detection, IP **hashing** for analytics.

### 2.2 Scope of the processing

| Aspect | Detail |
| --- | --- |
| Categories of personal data | See data inventory in §8 (Appendix A). |
| Special / sensitive data | National ID (Ghana Card) number; Ghana Card images (photo/identity document). |
| Volume / scale | `[TBD]` — expected applicant population (public officers subject to Article 286). |
| Geographical scope | Ghana; confirm whether any processor/hosting is offshore (see §4.4). |
| Data subjects | See §8 Appendix B (applicants/public officers; staff users). |
| Retention period | Per `DataRetentionPolicy`; statutory periods `[TBD]`. |
| Frequency | Continuous (always-on public portal). |

### 2.3 Context of the processing

| Question | Answer |
| --- | --- |
| Source of the data | Directly from the data subject (applicant self-service); staff-entered workflow records. |
| Relationship with individuals | Statutory/regulatory (public officers' constitutional declaration duty). |
| Degree of control individuals have | Can register, complete profile, initiate a declaration; cannot drive officer steps. |
| Would individuals expect this use? | Yes — declaration is a known statutory obligation; confirm transparency via privacy notice. |
| Children's data? | `[TBD]` — expected none (public officers are adults). |
| Prior concerns / security flaws | Documented and largely remediated in `security-assessment.md`. |
| Novel technology? | No novel/AI decisioning on individuals; analytics includes automated abuse scoring (non-determinative of declaration outcome). |
| Current state of the art for security | Encryption at rest for PII, TLS in transit, RBAC, audit logging (see §6). |

### 2.4 Purposes of the processing

| Purpose | Why | Intended benefit |
| --- | --- | --- |
| Enable digital asset declaration under Article 286(5) | Statutory compliance | Efficient, auditable compliance for public officers and the Audit Service. |
| Identity verification | Prevent fraudulent declarations | Integrity of the declaration register. |
| Workflow processing & receipting | Operational | Tracked, evidenced submissions and receipts. |
| Notifications | Keep applicants informed | Transparency and timeliness. |
| Security & abuse prevention | Protect the system and data | Confidentiality/availability of PII. |
| Audit & reporting | Accountability | Compliance evidence and oversight. |

---

## 3. Step 3 — Consultation

| Stakeholder | Consulted? | Input / outcome |
| --- | --- | --- |
| Data subjects / representatives | `[TBD]` | Capture how views were sought or why not. |
| Data Protection Officer/Supervisor | `[TBD]` | DPO advice recorded here. |
| Information Security / engineering | Partial | Evidenced by `security-assessment.md`. |
| Processors (hosting, SMS, email) | `[TBD]` | Confirm security assurances. |
| Data Protection Commission | `[TBD]` | Consult if high residual risk remains after mitigation. |
| Audit Service / Auditor-General stakeholders | `[TBD]` | Business-process owners. |

---

## 4. Step 4 — Assess necessity and proportionality

### 4.1 Lawful basis (Act 843)

| Item | Position |
| --- | --- |
| Lawful basis | `[TBD — recommend]` Processing necessary for compliance with a **legal obligation** / **public interest / exercise of official authority** (Article 286(5) statutory duty), not consent. |
| For the national-ID/image data | Necessary for identity verification integral to the statutory purpose. |
| Documented? | Record final basis in the RoPA and privacy notice. |

### 4.2 Necessity & proportionality

| Question | Response |
| --- | --- |
| Does the processing achieve the purpose? | Yes — digitized workflow fulfils the declaration obligation. |
| Is there a less intrusive way? | Ghana Card image collection: confirm whether number alone suffices for any step (data minimization). `[TBD]` |
| Data minimization | Collect only fields needed per `FormSection`; avoid PII in notifications and audit logs (tracked finding). |
| Accuracy | Applicant-entered + officer verification (`ApplicantVerificationReview`). |
| Storage limitation | Enforced via `DataRetentionPolicy` + prune tasks; statutory periods `[TBD]`. |
| Transparency | Public `/privacy` page; ensure it reflects actual processing and Act 843 rights. |

### 4.3 Data subject rights support

| Right | How supported | Gap |
| --- | --- | --- |
| Access | `[TBD]` — define DSAR procedure & SLA. | Procedure to be written. |
| Rectification | Profile edit + officer review. | Confirm post-submission correction path. |
| Erasure | Retention/archival tooling exists; balance against statutory retention. | Define erasure decision rules. |
| Restriction / objection | `[TBD]` | Procedure to be written. |
| Portability | `[TBD]` — likely N/A (legal-obligation basis). | Confirm. |
| Rights re automated decisions | No determinative automated decisions on individuals. | Confirm abuse-scoring is non-determinative. |

### 4.4 International transfers

| Question | Response |
| --- | --- |
| Any processor/hosting outside Ghana? | `[TBD]` |
| If yes, transfer safeguard | `[TBD]` — assess adequacy / contractual safeguards / DPC requirements. |

---

## 5. Step 5 — Identify and assess risks

Scoring: **Likelihood** (Low/Med/High) × **Impact** (Low/Med/High) →
**Risk** (Low/Med/High). Many technical mitigations already exist; pre-mitigation
scores assume controls absent, residual scores reflect implemented controls.

| # | Risk to individuals | Likelihood (pre) | Impact (pre) | Risk (pre) | Source/notes |
| --- | --- | --- | --- | --- | --- |
| R1 | Unauthorized disclosure of Ghana Card images (object-store exposure) | High | High | **High** | Bucket ACL / access controls — see C-4/M-6 findings. |
| R2 | Exposure of national-ID numbers (DB compromise / export leakage) | High | High | **High** | At-rest encryption mitigates; exports/audit-log leakage tracked. |
| R3 | Account takeover (token/credential compromise) | Med | High | **High** | JWT cookie flags, lockout, refresh replay detection. |
| R4 | Unauthorized internal access (over-broad staff access / IDOR) | Med | High | **High** | RBAC + officer scoping; access reviews `[TBD]`. |
| R5 | PII leakage into logs/exports | Med | High | **High** | Tracked finding: keep Ghana Card numbers/names out of `audit_logs` & CSV/PDF. |
| R6 | Excessive/over-collection of data | Med | Med | **Med** | Minimization review per `FormSection`. |
| R7 | Retention beyond necessity | Med | Med | **Med** | Retention policy exists; statutory periods `[TBD]`. |
| R8 | Inaccurate data leading to wrong workflow outcome | Low | Med | **Med** | Officer verification step. |
| R9 | Loss of availability (applicants can't meet statutory deadline) | Med | Med | **Med** | BCP/DR `[TBD]`. |
| R10 | Re-identification via analytics/IP tracking | Low | Med | **Low–Med** | IP hashing + DNT honoured. |
| R11 | Loss of PII encryption key → data unrecoverable | Low | High | **Med** | Key custody/escrow procedure `[TBD]` (H5). |
| R12 | Breach not detected/notified in time | Med | High | **High** | IR & breach-notification plan `[TBD]` (K1/K2). |

---

## 6. Step 6 — Measures to reduce or eliminate risk

| # (risk) | Mitigation measure | Effect (eliminated/reduced/accepted) | Residual likelihood | Residual impact | Residual risk | Status |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | Private buckets, no public-read ACL, signed-URL access, TLS to object store (`MINIO_USE_SSL`) | Reduced | Low | High | **Med** | Verify per `production-checklist.md` |
| R2 | AES-256-GCM field encryption + HMAC hash; restrict/redact exports; keep IDs out of logs | Reduced | Low | High | **Med** | Encryption done; export hygiene `[TBD]` |
| R3 | bcrypt, per-account lockout, refresh-token rotation + replay detection, `HttpOnly`/`Secure` cookies, MFA decision | Reduced | Low | High | **Med** | Confirm cookie flags; MFA `[TBD]` |
| R4 | RBAC role prefixes + `UserCollectionOffice` scoping + periodic access reviews | Reduced | Low | High | **Med** | Access-review records `[TBD]` |
| R5 | Field allow-listing in audit/export paths; redaction standard | Reduced | Low | High | **Med** | Implement & verify |
| R6 | Data-minimization review of collected fields | Reduced | Low | Med | **Low** | `[TBD]` |
| R7 | Statutory retention schedule + automated prune/archive | Reduced | Low | Med | **Low** | Periods `[TBD]` |
| R8 | Officer verification + rectification path | Reduced | Low | Med | **Low** | In place |
| R9 | Backup + DR plan with RPO/RTO, tested restore, health monitoring (`/api/health`) | Reduced | Low | Med | **Low–Med** | Plan & drill `[TBD]` |
| R10 | Salted IP hashing, DNT honoured, analytics toggles | Reduced | Low | Low | **Low** | In place |
| R11 | Key management procedure: secure storage, rotation, split-knowledge/escrow, backup of keys | Reduced | Low | High | **Med** | Procedure `[TBD]` |
| R12 | Incident response + breach-notification playbook (DPC/CSA timelines), monitoring/alerting | Reduced | Low | High | **Med** | Plans `[TBD]` |

---

## 7. Outcome & residual-risk decision

| Item | Detail |
| --- | --- |
| Residual risk level (overall) | `[TBD]` after mitigations actioned — target **Low/Medium**. |
| Any residual **High** risk? | If yes → **consult the Data Protection Commission before go-live**. |
| Measures approved | `[TBD]` |
| Residual risks accepted by | `[TBD]` (accountable owner) |
| Integrated into project plan / tracker | Link open items to the risk register & remediation tracker (POA&M). |
| DPO advice provided & followed? | `[TBD]` — record any deviation and justification. |
| Review trigger | Material change to processing, new data category, or new processor. |

---

## 8. Appendices

### Appendix A — Data inventory (personal data processed)

> Derived from `app/prisma/schema.prisma`. Validate against the live schema and
> classify each field (Restricted-PII / Confidential / Internal).

| Data element | Example model/field | Category | Sensitivity |
| --- | --- | --- | --- |
| Name | `ApplicantProfile` | Identity | Confidential |
| National ID (Ghana Card no.) | `ApplicantProfile` (encrypted + HMAC hash) | National identifier | **Restricted-PII** |
| Ghana Card image(s) | Object storage (MinIO) | Identity document/image | **Restricted-PII** |
| Alternate ID + reason | `IdDocumentType`, `AlternateIdReason` | Identity | Confidential |
| Contact details (email, phone) | `User` / `ApplicantProfile`, verification tokens | Contact | Confidential |
| Office/role/category | `ApplicantOffice`, `PublicOfficeCategory`, `Institution` | Employment/public office | Internal–Confidential |
| Declaration records & status history | `Declaration`, `DeclarationStatusHistory` | Workflow/asset-declaration | Confidential |
| Form collection / reissue records | `FormCollection`, `FormReissueRequest` | Workflow | Confidential |
| Reviews & receipts | `Review`, `Receipt`, `DeclarationSectionReview` | Workflow | Confidential |
| Notification preferences & delivery logs | `NotificationPreference`, `NotificationDeliveryLog` | Comms metadata | Internal |
| Accessibility preferences | `AccessibilityPreference` | Possibly health-adjacent | Confidential |
| Authentication data | `User` (bcrypt hash), `RefreshToken`, reset/verify tokens | Credentials | **Restricted** |
| Audit logs | `AuditLog` | Accountability (must not contain raw PII) | Confidential |
| Traffic/abuse/analytics | `TrafficEvent`, `AbuseEvent`, hashed IP | Behavioural/technical | Internal (pseudonymized) |
| Contact submissions | `ContactSubmission` | Correspondence | Confidential |

### Appendix B — Categories of data subjects

- **Applicants / public officers** subject to Article 286(5) declaration duty.
- **Staff users**: Schedule Officers, Legal Unit officers, Admins.
- **Website visitors** (analytics — pseudonymized).

### Appendix C — Recipients & processors

| Recipient/processor | Role | Data shared | Safeguard |
| --- | --- | --- | --- |
| Hosting / infrastructure provider | Processor | All stored data | `[TBD]` DPA + attestation |
| SMS gateway | Processor | Phone number, notification content | `[TBD]` DPA; no PII beyond necessary |
| Email provider/SMTP | Processor | Email, notification content | `[TBD]` DPA |
| Managed Postgres/Redis/object store (if any) | Processor | Stored data | `[TBD]` DPA |
| Audit Service / Auditor-General | Controller/recipient | Declaration outcomes | Statutory |

### Appendix D — Data flow summary

`Applicant → (HTTPS) → Nuxt/Nitro API → Postgres (encrypted PII) + MinIO (images) →
Officer/Legal/Admin workflow → Receipt PDF (MinIO) → Notifications (email/SMS) →
Retention/archive/prune.` Produce a diagram for the architecture pack (D5/C5 in
the audit checklist).

---

*This DPIA is a working scaffold, not legal advice. Finalize lawful basis,
retention periods, transfer safeguards, and residual-risk acceptance with the
Data Protection Officer and, where required, the Data Protection Commission.*
