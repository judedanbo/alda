# ADLA — Information Systems & Information Security Audit: Documentation Checklist

**Purpose.** A comprehensive list of documents an auditor is likely to request
when assessing the Asset Declaration Portal (ADLA) before deployment. ADLA is a
public-internet **government PII system** (Ghana Card images, national-ID
numbers, asset declarations under **Article 286(5)** of the 1992 Constitution),
so the audit will be judged against both general InfoSec frameworks
(**ISO/IEC 27001:2022**, **NIST CSF / SP 800-53**) and the **Ghana**
regulatory regime:

- **Data Protection Act, 2012 (Act 843)** and the Data Protection Commission's
  registration/compliance requirements.
- **Cybersecurity Act, 2020 (Act 1038)** and Cyber Security Authority (CSA)
  directives for critical/state information systems.
- **Electronic Transactions Act, 2008 (Act 772)**.
- The **Audit Service / Auditor-General** processes the workflow implements.

**How to use this list.** Each item below is a *document the audit may require*.
The **Status** column reflects what already exists in this repo so you can see
the gap at a glance:

- `Exists` — a usable artifact is already in the repo.
- `Partial` — related material exists but isn't a standalone, sign-off-ready document.
- `To create` — no current artifact.

Existing in-repo artifacts referenced below:

- [`docs/security-assessment.md`](./security-assessment.md) — static cybersecurity assessment (findings).
- [`docs/production-checklist.md`](./production-checklist.md) — pre-launch / post-deploy verification.
- [`docs/analytics-abuse-ratelimit.md`](./analytics-abuse-ratelimit.md) — analytics/abuse/rate-limit subsystem design.
- [`plans/asset-declaration-app.md`](../plans/asset-declaration-app.md) — product & architecture plan (source of truth for the workflow).
- [`CLAUDE.md`](../CLAUDE.md) — engineering/architecture reference.

> These are good evidence, but auditors distinguish **technical artifacts**
> (what engineers produced) from **governance documents** (approved, owned,
> versioned, signed policies and records). Most of the gaps below are the
> latter.

---

## A. Governance, Risk & Compliance (GRC)

| # | Document | Status | Notes for ADLA |
| --- | --- | --- | --- |
| A1 | Information Security Policy (apex policy) | To create | Top-level, management-approved policy that the rest of the suite hangs off. |
| A2 | Information Security Management System (ISMS) scope statement | To create | Defines boundary: the Nuxt app in `app/`, Postgres, Redis, MinIO, SMTP/SMS, hosting. |
| A3 | Statement of Applicability (SoA) — ISO 27001 Annex A controls | To create | Each control: applicable? implemented? justification. |
| A4 | Risk Assessment & Risk Treatment Plan (RTP) | Partial | `security-assessment.md` is the technical input; needs a formal risk register with likelihood/impact, owners, treatment decisions and residual-risk sign-off. |
| A5 | Risk register (live, owned) | To create | Tracks each risk, owner, status; should ingest the C/H/M findings from `security-assessment.md`. |
| A6 | Roles & responsibilities / RACI (incl. named Information Security Officer, Data Protection Officer) | To create | Act 843 effectively requires a Data Protection Supervisor/officer. |
| A7 | Asset inventory / information asset register | Partial | Data model is in `schema.prisma`; needs a business-level register classifying each asset (Ghana Card images, national IDs = highly sensitive). |
| A8 | Data classification & handling policy | To create | Defines tiers (Public / Internal / Confidential / Restricted-PII) and handling rules per tier. |
| A9 | Compliance obligations register (legal/regulatory mapping) | To create | Maps Act 843, Act 1038, Act 772, Article 286 obligations to controls. |
| A10 | Management review minutes / security governance meeting records | To create | Evidence the ISMS is actively governed. |
| A11 | Internal audit plan & prior internal-audit reports | To create | Demonstrates self-assessment before external audit. |

## B. Information Security Policy Suite

| # | Document | Status | Notes for ADLA |
| --- | --- | --- | --- |
| B1 | Acceptable Use Policy | To create | For staff/officers (Schedule Officer, Legal Unit, Admin). |
| B2 | Access Control Policy | Partial | Enforced in code (`server/middleware/auth.ts`, role prefixes, officer scoping); needs a written policy stating the model. |
| B3 | Password / Authentication Policy | Partial | bcrypt, lockout (`auth-lockout.ts`), refresh-token rotation exist; document complexity, lockout thresholds, MFA stance. |
| B4 | Cryptography / Encryption & Key Management Policy | Partial | PII field encryption (`pii-encryption.ts`, AES-256-GCM + HMAC) exists; needs policy on algorithms, key rotation, custody, escrow. |
| B5 | Logging & Monitoring Policy | Partial | Audit-log subsystem exists (`audit.ts`, BullMQ); document what's logged, retention, review cadence, tamper-protection. |
| B6 | Backup & Recovery Policy | To create | RPO/RTO for Postgres + MinIO objects. |
| B7 | Change Management Policy | To create | How code/schema/infra changes are reviewed, approved, deployed. |
| B8 | Secure Development Policy (SSDLC) | Partial | Practices exist (Zod validation, parameterized Prisma, ESLint); needs written secure-coding standard. |
| B9 | Vulnerability & Patch Management Policy | To create | Cadence for dependency updates (see `plans/deprecated-packages-migration.md`), CVE triage, SLA per severity. |
| B10 | Remote Access / Endpoint / BYOD Policy | To create | If officers access from field offices. |
| B11 | Mobile & Email/SMS communications policy | Partial | Email/SMS notification service exists; cover content limits (no PII in notifications). |
| B12 | Data Retention & Disposal Policy | Partial | `DataRetentionPolicy` / `ArchivedRecord` models + analytics prune tasks exist; needs the governing policy doc with statutory retention periods. |
| B13 | Clear desk / clear screen & physical media policy | To create | For form-collection offices handling physical declaration forms. |
| B14 | Anti-malware / system hardening policy | To create | Baseline hardening for app/DB/object-store hosts and containers. |
| B15 | Network Security Policy | Partial | Rate limiting, trusted-proxy handling, security headers exist; document segmentation, firewall/ingress rules. |
| B16 | Document & records management / version control policy | To create | How these very policies are versioned and approved. |

## C. Data Protection & Privacy (Ghana Act 843 focus)

| # | Document | Status | Notes for ADLA |
| --- | --- | --- | --- |
| C1 | Privacy Policy (public-facing) | Partial | A `/privacy` page exists in the app; confirm it reflects actual processing and Act 843 rights. |
| C2 | Data Protection Commission registration certificate (Data Controller) | To create | Act 843 requires registration as a data controller; auditors will ask for the certificate. |
| C3 | Data Protection Impact Assessment (DPIA) | To create | **High priority** — large-scale processing of national-ID + biometric-adjacent (Ghana Card) data triggers a DPIA. |
| C4 | Records of Processing Activities (RoPA) / data inventory | Partial | Derivable from `schema.prisma`; needs a formal RoPA: purpose, lawful basis, categories, recipients, retention, transfers. |
| C5 | Data flow diagrams (PII lifecycle: capture → store → process → export → archive/delete) | To create | Show Ghana Card image path (upload → MinIO), national-ID encryption, exports (CSV/PDF receipts). |
| C6 | Lawful basis / consent records & consent capture evidence | Partial | Registration flow exists; document the legal basis (statutory obligation under Article 286). |
| C7 | Data Subject Rights (DSAR) procedure | To create | How applicants request access/correction/erasure; SLA and verification steps. |
| C8 | Data breach notification procedure (Act 843 / CSA timelines) | To create | Who notifies the DPC/CSA and affected subjects, and within what time. |
| C9 | Data Processing Agreements (DPAs) with processors | To create | For any SMS gateway, email provider, hosting/cloud, managed Postgres/Redis/object-store. |
| C10 | Cross-border data transfer assessment | To create | Required if hosting or any processor is outside Ghana. |
| C11 | Data minimization & pseudonymization/anonymization standard | Partial | IP hashing (`ANALYTICS_IP_SALT`) and PII encryption exist; document the approach. |
| C12 | Retention schedule (statutory periods per data category) | Partial | `DataRetentionPolicy` model exists; map each category to a legal retention period. |
| C13 | Cookie / tracking & analytics notice | Partial | Analytics subsystem honours DNT; ensure disclosure aligns. |

## D. System & Architecture Documentation

| # | Document | Status | Notes for ADLA |
| --- | --- | --- | --- |
| D1 | System architecture document (logical + deployment) | Partial | `CLAUDE.md` + `plans/asset-declaration-app.md` cover much; produce an auditor-facing architecture doc with diagrams. |
| D2 | Network/infrastructure topology diagram | To create | Ingress/proxy, app pods, Postgres, Redis, MinIO, MailHog/SMTP, SMS gateway, trust zones. |
| D3 | Data model / ERD & data dictionary | Partial | `schema.prisma` is authoritative; generate an ERD + field-level dictionary, flagging PII columns. |
| D4 | Workflow / state-machine specification | Exists | Declaration state machine documented in `CLAUDE.md` and `plans/asset-declaration-app.md` (`CODE_GENERATED → … → COMPLETED`), plus the flowchart PDF in `docs/`. |
| D5 | API inventory / interface specification | Partial | Nitro routes under `app/server/api/`; produce an endpoint catalogue with auth/role requirements. |
| D6 | Integration / interface control documents (SMS, email, object storage) | To create | Per external interface: protocol, auth, data exchanged, failure handling, webhook secrets. |
| D7 | Environment / configuration specification | Exists | `app/.env.example` + `production-checklist.md` document every variable and the startup-gate (`00.config-validation.ts`). |
| D8 | Software Bill of Materials (SBOM) & dependency inventory | Partial | `package.json` / lockfile + `plans/deprecated-packages-migration.md`; generate a formal SBOM (e.g. CycloneDX) + license inventory. |
| D9 | Capacity / performance / scalability plan | To create | Sizing for Postgres, Redis, worker concurrency (notifications/audit queues). |

## E. Identity & Access Management

| # | Document | Status | Notes for ADLA |
| --- | --- | --- | --- |
| E1 | RBAC role-definition matrix (roles → permissions/routes) | Partial | Roles are exactly `applicant, schedule_officer, legal_unit, admin`; officer scoping via `UserCollectionOffice`. Produce the formal matrix. |
| E2 | User access provisioning / de-provisioning (JML) procedure | To create | Joiner/Mover/Leaver for officers and admins. |
| E3 | Privileged access management (admin accounts) procedure | To create | Admin has access to audit logs, reports, user/institution management. |
| E4 | Periodic access review / recertification records | To create | Evidence access is reviewed (e.g. quarterly). |
| E5 | Segregation of duties matrix | Partial | Workflow already separates Applicant / Schedule Officer / Legal Unit / Admin; document SoD explicitly. |
| E6 | Authentication design doc (JWT, refresh-token rotation, lockout, MFA stance) | Partial | `jwt.ts`, `auth-lockout.ts`, refresh-token family/replay detection exist; consolidate into one design doc and state MFA decision. |
| E7 | Session management specification | Partial | Token TTLs (`JWT_EXPIRES_IN` 15m / refresh 7d) and cookie flags; document and confirm `HttpOnly`/`Secure` per H-finding remediation. |

## F. Secure SDLC, Change & Release Management

| # | Document | Status | Notes for ADLA |
| --- | --- | --- | --- |
| F1 | Secure SDLC procedure | Partial | Code review, lint, tests exist; document the gated pipeline. |
| F2 | Change management records / change log | Partial | Git history + `.github/` workflows; produce a change-record template and approvals trail. |
| F3 | Code review policy & evidence (PR approvals) | Partial | Repo uses PRs; capture the review-gate policy. |
| F4 | CI/CD pipeline documentation & security gates | Partial | `.github/` workflows present; document SAST/dependency-scan/secret-scan gates. |
| F5 | Branching, versioning & release management procedure | To create | How releases are cut, tagged, approved for production. |
| F6 | Migration & rollback procedures | Partial | PII-encryption two-step migration + backfill documented in `CLAUDE.md` / `production-checklist.md`; add rollback playbook. |
| F7 | Test strategy & test plans | Partial | Vitest (`test:unit`) + Playwright (`test:e2e`) exist; document coverage targets and security test cases. |
| F8 | Test evidence / results & UAT sign-off | To create | Auditors want passing-test evidence and business UAT acceptance. |
| F9 | Separation of dev/test/prod environments statement | Partial | `docker-compose.dev.yml` is dev; document the prod environment separation and data-handling (no real PII in non-prod). |

## G. Application Security Evidence

| # | Document | Status | Notes for ADLA |
| --- | --- | --- | --- |
| G1 | Application security assessment / code review report | Exists | `docs/security-assessment.md`. |
| G2 | Penetration test report (independent, recent) | To create | **High priority** — auditors of a public PII portal expect a third-party pentest with a remediation/retest letter. |
| G3 | Vulnerability scan reports (DAST + dependency/SCA) | Partial | Dependency posture in `plans/deprecated-packages-migration.md`; run and attach automated scans. |
| G4 | Threat model document | Partial | Threat model summarized in `security-assessment.md`; expand to a standalone STRIDE/data-flow threat model. |
| G5 | Remediation tracker / POA&M (plan of action & milestones) | Partial | The C/H/M findings need a tracked closure log with dates and owners. |
| G6 | Input-validation & output-encoding standard | Partial | Zod schemas centralized in `validators.ts`; document the standard. |
| G7 | File-upload security controls doc | Partial | Ghana Card upload path (`storage.service.ts`), MIME/magic-byte and ACL controls referenced in findings; document the control set. |
| G8 | Security headers / CSP configuration record | Partial | `01.security-headers.ts`, `SECURITY_CSP_ENFORCE`; record final enforced policy. |
| G9 | Rate-limiting & anti-abuse design | Exists | `docs/analytics-abuse-ratelimit.md` + middleware `00.security.ts`, `rate-limit-user.ts`. |

## H. Cryptography & Key Management

| # | Document | Status | Notes for ADLA |
| --- | --- | --- | --- |
| H1 | Encryption standard (in-transit & at-rest) | Partial | TLS to MinIO (`MINIO_USE_SSL`), PII field encryption; document TLS versions, ciphers, at-rest scope (DB, object store, backups). |
| H2 | Key management procedure (generation, storage, rotation, destruction) | To create | Covers `PII_ENCRYPTION_KEY`, `PII_HMAC_KEY`, `JWT_SECRET`/`JWT_REFRESH_SECRET`, MinIO creds, webhook secrets. |
| H3 | Secrets management design (where prod secrets live) | Partial | `production-checklist.md` says "secret manager, never commit"; name the actual secret store and access controls. |
| H4 | Certificate management / TLS inventory | To create | Public TLS certs, renewal ownership. |
| H5 | Key custody / split-knowledge & escrow records | To create | Especially for the PII encryption key — losing it makes national-ID data unrecoverable. |

## I. Logging, Monitoring & Audit Trail

| # | Document | Status | Notes for ADLA |
| --- | --- | --- | --- |
| I1 | Audit logging design & coverage matrix | Partial | `audit.ts` + `AuditActions`, durable BullMQ writes; document which actions are logged (compliance requirement, not debug). |
| I2 | Log retention & protection (tamper-evidence) procedure | To create | Retention period, immutability, access restriction; note finding that PII must not leak into `audit_logs`. |
| I3 | Security monitoring / alerting & SIEM integration plan | To create | What triggers alerts (e.g. `REFRESH_TOKEN_REPLAY_DETECTED`, lockouts, abuse events). |
| I4 | Time synchronization (NTP) standard | To create | Reliable timestamps for audit defensibility. |
| I5 | Monitoring of availability & health | Partial | `/api/health` endpoint exists; document uptime monitoring. |

## J. Operations, Backup, BCP & DR

| # | Document | Status | Notes for ADLA |
| --- | --- | --- | --- |
| J1 | Operations / runbook manual | Partial | `production-checklist.md` covers deploy & smoke checks; expand to full ops runbook. |
| J2 | Backup procedure & restore-test evidence | To create | Postgres + MinIO objects; **include evidence a restore was actually tested**. |
| J3 | Business Continuity Plan (BCP) | To create | Continuity of the declaration workflow during outage. |
| J4 | Disaster Recovery Plan (DR) with RPO/RTO | To create | Stated RPO/RTO and failover steps. |
| J5 | BCP/DR test results | To create | Auditors want evidence of an actual drill. |
| J6 | Service Level Agreements / Objectives (SLA/SLO) | To create | Availability targets and support hours. |
| J7 | Maintenance & patching schedule | To create | Windows and responsibilities. |

## K. Incident Response

| # | Document | Status | Notes for ADLA |
| --- | --- | --- | --- |
| K1 | Incident Response Plan (IRP) | To create | Roles, severities, escalation, communications. |
| K2 | Data breach response & regulator-notification playbook | To create | Act 843 (DPC) and Act 1038 (CSA / National CERT) notification timelines and templates. |
| K3 | Incident register / log | To create | Even if empty, the register must exist. |
| K4 | Forensic readiness & evidence-handling procedure | To create | Preserving logs/images for investigation. |
| K5 | Post-incident review template | To create | Lessons-learned process. |

## L. Third-Party, Vendor & Supply-Chain

| # | Document | Status | Notes for ADLA |
| --- | --- | --- | --- |
| L1 | Vendor/third-party register | To create | Hosting, SMS gateway, email provider, managed data stores. |
| L2 | Vendor security due-diligence / assessment records | To create | Per provider. |
| L3 | Contracts & SLAs with providers | To create | Including the DPAs from C9. |
| L4 | Open-source / third-party license compliance report | Partial | Derivable from lockfile; produce a license inventory. |
| L5 | Supply-chain integrity controls (dependency pinning, provenance) | Partial | Lockfile + `deprecated-packages-migration.md`; document dependency-scanning and pinning policy. |

## M. Physical & Environmental / Hosting

| # | Document | Status | Notes for ADLA |
| --- | --- | --- | --- |
| M1 | Hosting / data-center security attestation (e.g. ISO 27001, SOC 2 of provider) | To create | For the cloud/data-center hosting the prod stack. |
| M2 | Physical access control records (offices handling physical forms) | To create | Form-collection offices store physical declaration forms. |
| M3 | Environmental controls statement (power, cooling, fire) | To create | Usually satisfied by provider attestation. |
| M4 | Media handling & secure disposal records | To create | Scanned letters, printed receipts. |

## N. Human Resources & Awareness

| # | Document | Status | Notes for ADLA |
| --- | --- | --- | --- |
| N1 | Security awareness training material & completion records | To create | For all staff with system access. |
| N2 | Confidentiality / NDA agreements (staff & contractors) | To create | Given PII exposure. |
| N3 | Background-check / vetting policy & records | To create | Especially for Admin / Legal Unit / Schedule Officers. |
| N4 | Disciplinary process for security violations | To create | Required by ISO 27001 A.6. |
| N5 | Onboarding/offboarding checklist (ties to E2 JML) | To create | Account + asset return on exit. |

## O. Deployment, Go-Live & Assurance

| # | Document | Status | Notes for ADLA |
| --- | --- | --- | --- |
| O1 | Pre-production / go-live security checklist | Exists | `docs/production-checklist.md`. |
| O2 | Production readiness review / sign-off record | To create | Formal approval to deploy. |
| O3 | Configuration baseline / hardening evidence (CIS benchmarks) | To create | For OS, containers, Postgres, Redis, MinIO, reverse proxy. |
| O4 | Authorization to Operate (ATO) / accreditation decision | To create | Government systems typically require a formal authorization to operate. |
| O5 | Residual-risk acceptance & management sign-off | To create | Signed acceptance of any open findings at go-live. |
| O6 | Audit response / evidence index (this document's companion) | To create | A mapping from auditor request → evidence location. |

---

## Priority shortlist (highest audit leverage)

If time is limited before the audit, produce these first — they are the items
auditors of a public-sector PII portal most reliably block on:

1. **DPIA** (C3) and **RoPA** (C4) — Act 843 expects both for large-scale ID processing.
2. **Data Protection Commission registration** (C2) as a data controller.
3. **Independent penetration test report + remediation evidence** (G2, G5).
4. **Risk assessment + risk register + Statement of Applicability** (A3–A5).
5. **Incident Response & breach-notification plan** with DPC/CSA timelines (K1, K2, C8).
6. **Backup + DR plan with a tested restore** (J2, J4, J5).
7. **Key management procedure** covering the PII encryption keys (H2, H5).
8. **Access control policy + RBAC matrix + access-review evidence** (B2, E1, E4).
9. **The core security policy suite** (A1, B-series) — many controls already
   exist in code; they need approved, owned, versioned policy documents.
10. **Production readiness sign-off / ATO** (O2, O4, O5).

> **Strong existing position.** The codebase already implements a large share
> of the *technical* controls these documents describe (PII encryption, audit
> logging, layered rate limiting, RBAC with officer scoping, secret startup
> gate, refresh-token replay detection). The audit gap is mostly **governance
> documentation** — turning implemented controls into approved, signed,
> reviewable policies and records, plus the privacy/DPIA and independent-test
> artifacts a government PII system is held to.

---

*This checklist is a planning aid, not legal advice. Confirm exact obligations
with the Data Protection Commission, the Cyber Security Authority, and the
engaged audit firm, and align document ownership and approval with your
organization's governance structure.*
