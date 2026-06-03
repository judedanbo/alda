# ADLA — Information Systems & Information Security Audit: Documentation Checklist

**Purpose.** A comprehensive list of documents an auditor is likely to request
when assessing the Asset Declaration Portal (ADLA) before deployment, and a live
index of which have been produced. ADLA is a public-internet **government PII
system** (Ghana Card images, national-ID numbers, asset declarations under
**Article 286(5)** of the 1992 Constitution), so the audit will be judged
against both general InfoSec frameworks (**ISO/IEC 27001:2022**, **NIST CSF /
SP 800-53**) and the **Ghana** regulatory regime:

- **Data Protection Act, 2012 (Act 843)** and the Data Protection Commission's
  registration/compliance requirements.
- **Cybersecurity Act, 2020 (Act 1038)** and Cyber Security Authority (CSA)
  directives for critical/state information systems.
- **Electronic Transactions Act, 2008 (Act 772)**.
- The **Audit Service / Auditor-General** processes the workflow implements.

## Status legend

- `Exists` — a usable, pre-existing artifact is in the repo.
- `Drafted` — a standalone draft document has been produced in this effort and
  is **pending owner review and management approval** (most carry `[TBD]`
  placeholders for org-specific inputs).
- `Partial` — relevant material exists (often embedded in another doc) but isn't
  a standalone, sign-off-ready artifact.
- `To create` — no current artifact; typically requires external action
  (filing, third party, vendor) or evidence from an actual activity.

> **At a glance.** The governance-documentation suite has largely been drafted:
> 21 documents now exist as standalone drafts. The remaining gaps are mostly
> **execution and external action** — an independent penetration test, DPC
> registration, processor DPAs, management sign-off, and operational evidence
> (restore tests, access reviews, training records) — not further drafting.

## Documents produced in this effort

| Document | Covers |
| --- | --- |
| [`information-security-policy.md`](./information-security-policy.md) | Apex ISP (A1), ISMS scope (A2), RACI (A6) |
| [`statement-of-applicability.md`](./statement-of-applicability.md) | SoA — all 93 Annex A controls (A3) |
| [`risk-register.md`](./risk-register.md) | Risk assessment/RTP (A4), risk register (A5), POA&M (G5), residual-acceptance log (O5) |
| [`access-control-policy.md`](./access-control-policy.md) | Access control (B2), RBAC matrix (E1), SoD (E5), auth/session (E6/E7) |
| [`data-classification-policy.md`](./data-classification-policy.md) | Data classification & handling (A8), minimization standard (C11) |
| [`cryptography-policy.md`](./cryptography-policy.md) | Encryption standard (B4/H1) |
| [`key-management-procedure.md`](./key-management-procedure.md) | Key management (H2), escrow/custody (H5) |
| [`secure-development-policy.md`](./secure-development-policy.md) | Secure SDLC (B8/F1), code review (F3), validation standard (G6), migration/rollback (F6) |
| [`vulnerability-patch-management-policy.md`](./vulnerability-patch-management-policy.md) | Vuln & patch mgmt (B9), maintenance schedule (J7) |
| [`logging-monitoring-policy.md`](./logging-monitoring-policy.md) | Logging design (I1), retention/protection (I2), monitoring (I3/I5) |
| [`change-management-policy.md`](./change-management-policy.md) | Change management (B7/F2) |
| [`incident-response-plan.md`](./incident-response-plan.md) | IRP (K1), breach notification (K2/C8), register (K3), post-incident review (K5) |
| [`backup-dr-plan.md`](./backup-dr-plan.md) | Backup & recovery (B6/J2), DR + RPO/RTO (J4), BCP (J3) |
| [`dpia.md`](./dpia.md) | DPIA (C3), data inventory (A7) |
| [`ropa.md`](./ropa.md) | RoPA (C4) |
| [`dsar-procedure.md`](./dsar-procedure.md) | Data-subject rights procedure (C7) |
| [`acceptable-use-policy.md`](./acceptable-use-policy.md) | Acceptable use (B1) |
| [`hr-security-policy.md`](./hr-security-policy.md) | Screening (N3), disciplinary (N4), JML (E2/N5) |
| [`security-awareness-training-policy.md`](./security-awareness-training-policy.md) | Awareness & training (N1) |
| [`confidentiality-nda-agreement.md`](./confidentiality-nda-agreement.md) | Confidentiality/NDA template (N2) |
| [`remote-working-policy.md`](./remote-working-policy.md) | Remote access/endpoint (B10) |
| [`architecture.md`](./architecture.md) | System architecture (D1), topology (D2), PII data-flow (C5) |
| [`data-model.md`](./data-model.md) | ERD + data dictionary (D3) |
| [`api-inventory.md`](./api-inventory.md) | API/interface inventory (D5) |
| [`integration-control-documents.md`](./integration-control-documents.md) | Integration control docs (D6) |
| [`diagrams/`](./diagrams/) | Mermaid sources + exported SVGs for all architecture/ERD diagrams |
| [`sbom.md`](./sbom.md) + [`sbom/`](./sbom/) | Software Bill of Materials (D8) + license compliance (L4) |

Pre-existing artifacts referenced below:

- [`security-assessment.md`](./security-assessment.md) — static cybersecurity assessment (findings).
- [`production-checklist.md`](./production-checklist.md) — pre-launch / post-deploy verification.
- [`analytics-abuse-ratelimit.md`](./analytics-abuse-ratelimit.md) — analytics/abuse/rate-limit subsystem design.
- [`plans/asset-declaration-app.md`](../plans/asset-declaration-app.md) — product & architecture plan.
- [`CLAUDE.md`](../CLAUDE.md) — engineering/architecture reference.

---

## A. Governance, Risk & Compliance (GRC)

| # | Document | Status | Notes for ADLA |
| --- | --- | --- | --- |
| A1 | Information Security Policy (apex policy) | Drafted | `information-security-policy.md` — pending management approval. |
| A2 | ISMS scope statement | Drafted | In `statement-of-applicability.md` §0 and `information-security-policy.md` §2. |
| A3 | Statement of Applicability (SoA) | Drafted | `statement-of-applicability.md` — all 93 Annex A:2022 controls mapped. |
| A4 | Risk Assessment & Risk Treatment Plan | Drafted | `risk-register.md` — inherent/residual scoring + treatment. |
| A5 | Risk register (live, owned) | Drafted | `risk-register.md` — RR-01..RR-20, owners `[TBD]`. |
| A6 | Roles & responsibilities / RACI | Drafted | Roles in ISP §5 / ACP; **named individuals `[TBD]`**. |
| A7 | Asset / information inventory | Drafted | Data inventory in `dpia.md` App.A + `ropa.md`; business asset register optional. |
| A8 | Data classification & handling policy | Drafted | `data-classification-policy.md`. |
| A9 | Compliance obligations register | Partial | Act 843/1038/772 + Article 286 mapped across DPIA/RoPA/IRP/SoA 5.31; standalone register `[TBD]`. |
| A10 | Management review minutes / governance records | To create | Requires actual governance meetings. |
| A11 | Internal audit plan & reports | To create | Self-assessment before external audit. |

## B. Information Security Policy Suite

| # | Document | Status | Notes for ADLA |
| --- | --- | --- | --- |
| B1 | Acceptable Use Policy | Drafted | `acceptable-use-policy.md`. |
| B2 | Access Control Policy | Drafted | `access-control-policy.md`. |
| B3 | Password / Authentication Policy | Drafted | Auth requirements in ACP §4; **password complexity + MFA decision `[TBD]`**. |
| B4 | Cryptography / Key Management Policy | Drafted | `cryptography-policy.md` + `key-management-procedure.md`. |
| B5 | Logging & Monitoring Policy | Drafted | `logging-monitoring-policy.md`. |
| B6 | Backup & Recovery Policy | Drafted | `backup-dr-plan.md`. |
| B7 | Change Management Policy | Drafted | `change-management-policy.md`. |
| B8 | Secure Development Policy (SSDLC) | Drafted | `secure-development-policy.md`. |
| B9 | Vulnerability & Patch Management Policy | Drafted | `vulnerability-patch-management-policy.md`. |
| B10 | Remote Access / Endpoint Policy | Drafted | `remote-working-policy.md`. |
| B11 | Email/SMS communications policy | Partial | "No PII in comms" rule in data-classification §3-4 + acceptable-use §4; standalone comms policy optional. |
| B12 | Data Retention & Disposal Policy | Partial | Handling in data-classification + `DataRetentionPolicy`; **statutory retention periods `[TBD]`**. |
| B13 | Clear desk / clear screen & physical media | Partial | Covered in acceptable-use §4, remote-working §5, data-classification disposal; physical records `[TBD]`. |
| B14 | Anti-malware / system hardening | Partial | Referenced in vuln/patch §4, SoA 8.7; **baseline/CIS evidence `[TBD]`** (see O3). |
| B15 | Network Security Policy | Partial | Controls in `00.security.ts` + `analytics-abuse-ratelimit.md`; SoA 8.20-8.22; topology doc `[TBD]` (D2). |
| B16 | Document & records management | Partial | Each doc carries a version-control header; formal records policy `[TBD]`. |

## C. Data Protection & Privacy (Ghana Act 843 focus)

| # | Document | Status | Notes for ADLA |
| --- | --- | --- | --- |
| C1 | Privacy Policy (public-facing) | Partial | App `/privacy` page; confirm it matches actual processing + Act 843 rights. |
| C2 | DPC registration certificate (Data Controller) | To create | **Act 843 filing** — register as data controller; obtain certificate. |
| C3 | Data Protection Impact Assessment (DPIA) | Drafted | `dpia.md`. |
| C4 | Records of Processing Activities (RoPA) | Drafted | `ropa.md`. |
| C5 | Data flow diagrams | Drafted | PII data-flow diagram in `architecture.md` §5 (+ `dpia.md` §8 App.D). |
| C6 | Lawful basis / consent records | Partial | Assessed in DPIA §4.1 / RoPA per activity; **final basis confirmation `[TBD]`**. |
| C7 | Data Subject Rights (DSAR) procedure | Drafted | `dsar-procedure.md`. |
| C8 | Breach notification procedure | Drafted | `incident-response-plan.md` §6-7 (DPC/CSA timelines + templates). |
| C9 | Data Processing Agreements (DPAs) | To create | **Needs vendors** — SMS, email, hosting, managed data stores. |
| C10 | Cross-border data transfer assessment | To create | Flagged in DPIA §4.4 / RR-17; **assess once hosting/processor locale known**. |
| C11 | Data minimization & pseudonymization standard | Drafted | data-classification §4 + cryptography (IP hashing, PII encryption). |
| C12 | Retention schedule (statutory periods) | Partial | `DataRetentionPolicy` exists; **map each category to a legal period `[TBD]`**. |
| C13 | Cookie / analytics notice | Partial | Analytics honours DNT; align disclosure on `/privacy`. |

## D. System & Architecture Documentation

| # | Document | Status | Notes for ADLA |
| --- | --- | --- | --- |
| D1 | System architecture document | Drafted | `architecture.md` — context, component, deployment, decisions (Mermaid + SVG). |
| D2 | Network/infrastructure topology diagram | Drafted | `architecture.md` §4 — trust zones, web/worker pods, data stores, external services. |
| D3 | Data model / ERD & data dictionary | Drafted | `data-model.md` — 6 cluster ERDs + PII-flagged dictionary. |
| D4 | Workflow / state-machine specification | Exists | `CLAUDE.md`, plan, flowchart PDF; also `architecture.md` §6. |
| D5 | API inventory / interface specification | Drafted | `api-inventory.md` — full endpoint catalogue with roles. |
| D6 | Integration / interface control documents | Drafted | `integration-control-documents.md` — one ICD per external system. |
| D7 | Environment / configuration specification | Exists | `.env.example` + `production-checklist.md` + startup gate. |
| D8 | Software Bill of Materials (SBOM) | Drafted | `sbom.md` + `sbom/*.json` (CycloneDX + SPDX, 982 components); regenerate on dependency change. |
| D9 | Capacity / performance plan | To create | Sizing for DB, Redis, worker concurrency. |

## E. Identity & Access Management

| # | Document | Status | Notes for ADLA |
| --- | --- | --- | --- |
| E1 | RBAC role-definition matrix | Drafted | `access-control-policy.md` §3.1. |
| E2 | Provisioning / de-provisioning (JML) | Drafted | `hr-security-policy.md` §5 + ACP §5. |
| E3 | Privileged access management | Drafted | ACP §6 + hr-security; **PAM tooling/review cadence `[TBD]`**. |
| E4 | Periodic access review records | To create | Policy in ACP §5; **actual recertification evidence `[TBD]`**. |
| E5 | Segregation of duties matrix | Drafted | ACP §2 + role matrix. |
| E6 | Authentication design doc | Drafted | ACP §4 + cryptography; **MFA decision `[TBD]`**. |
| E7 | Session management specification | Drafted | ACP §4 (TTLs, cookies); **confirm `HttpOnly`/`Secure` `[TBD]`**. |

## F. Secure SDLC, Change & Release Management

| # | Document | Status | Notes for ADLA |
| --- | --- | --- | --- |
| F1 | Secure SDLC procedure | Drafted | `secure-development-policy.md`. |
| F2 | Change management records / log | Drafted | `change-management-policy.md`; change-log/ticket artifact `[TBD]`. |
| F3 | Code review policy & evidence | Drafted | secure-development §2 + change-management §3; PR evidence in git. |
| F4 | CI/CD pipeline & security gates | Partial | `.github/` workflows; **add SAST/SCA/secret-scan gates `[TBD]`**. |
| F5 | Branching/versioning/release procedure | Partial | change-management §2-3; formal release procedure `[TBD]`. |
| F6 | Migration & rollback procedures | Drafted | change-management §4/§6 + `CLAUDE.md`/PC. |
| F7 | Test strategy & test plans | Partial | secure-development §5; **coverage targets + security cases `[TBD]`**. |
| F8 | Test evidence / UAT sign-off | To create | Requires passing-test evidence + business UAT. |
| F9 | Dev/test/prod separation statement | Partial | secure-development §6 + change-management §7; document/enforce `[TBD]`. |

## G. Application Security Evidence

| # | Document | Status | Notes for ADLA |
| --- | --- | --- | --- |
| G1 | Application security assessment | Exists | `security-assessment.md`. |
| G2 | Penetration test report (independent) | To create | **High priority — third party** (RR-20). |
| G3 | Vulnerability scan reports (DAST/SCA) | Partial | vuln/patch policy defines cadence; **run + attach scans `[TBD]`**. |
| G4 | Threat model document | Partial | `security-assessment.md` + DPIA §5; standalone STRIDE `[TBD]`. |
| G5 | Remediation tracker / POA&M | Drafted | `risk-register.md` (RR-01..20 with treatment/owners). |
| G6 | Input-validation & output-encoding standard | Drafted | secure-development §3. |
| G7 | File-upload security controls doc | Partial | secure-development + data-classification; standalone doc `[TBD]`. |
| G8 | Security headers / CSP record | Partial | `01.security-headers.ts`, `SECURITY_CSP_ENFORCE`; **record final enforced policy `[TBD]`**. |
| G9 | Rate-limiting & anti-abuse design | Exists | `analytics-abuse-ratelimit.md`. |

## H. Cryptography & Key Management

| # | Document | Status | Notes for ADLA |
| --- | --- | --- | --- |
| H1 | Encryption standard (in-transit & at-rest) | Drafted | `cryptography-policy.md`. |
| H2 | Key management procedure | Drafted | `key-management-procedure.md`. |
| H3 | Secrets management design | Partial | KMP §4; **name the production secret store `[TBD]`**. |
| H4 | Certificate management / TLS inventory | Partial | KMP K11; **TLS inventory + renewal owner `[TBD]`**. |
| H5 | Key custody / escrow records | Drafted | KMP §8 procedure; **actual escrow + recovery test `[TBD]`** (RR-11). |

## I. Logging, Monitoring & Audit Trail

| # | Document | Status | Notes for ADLA |
| --- | --- | --- | --- |
| I1 | Audit logging design & coverage matrix | Drafted | `logging-monitoring-policy.md` §2. |
| I2 | Log retention & protection procedure | Drafted | logging-monitoring §4-5; **enable tamper-resistant storage `[TBD]`**. |
| I3 | Security monitoring / alerting / SIEM plan | Partial | logging-monitoring §6; **stand up SIEM/alerting `[TBD]`**. |
| I4 | Time synchronization (NTP) standard | Partial | logging-monitoring §4 + open items; **configure NTP `[TBD]`**. |
| I5 | Availability & health monitoring | Partial | `/api/health`; **external uptime monitor `[TBD]`**. |

## J. Operations, Backup, BCP & DR

| # | Document | Status | Notes for ADLA |
| --- | --- | --- | --- |
| J1 | Operations / runbook manual | Partial | PC + backup-dr §4; full runbook `[TBD]`. |
| J2 | Backup procedure & restore-test evidence | Drafted | `backup-dr-plan.md`; **perform + evidence a restore `[TBD]`**. |
| J3 | Business Continuity Plan (BCP) | Drafted | backup-dr §5; standalone BCP optional. |
| J4 | Disaster Recovery Plan (RPO/RTO) | Drafted | backup-dr §2/§5; **set RPO/RTO values `[TBD]`**. |
| J5 | BCP/DR test results | To create | **Requires an actual drill**. |
| J6 | SLA / SLO | Partial | backup-dr §2 references; formal SLA `[TBD]`. |
| J7 | Maintenance & patching schedule | Drafted | vuln/patch §4 + change-management; windows `[TBD]`. |

## K. Incident Response

| # | Document | Status | Notes for ADLA |
| --- | --- | --- | --- |
| K1 | Incident Response Plan (IRP) | Drafted | `incident-response-plan.md`. |
| K2 | Breach response & regulator-notification playbook | Drafted | IRP §6-7 (DPC/CSA + templates). |
| K3 | Incident register / log | Drafted | IRP §8 (register established). |
| K4 | Forensic readiness & evidence handling | Partial | IRP §5.3; detailed procedure `[TBD]`. |
| K5 | Post-incident review template | Drafted | IRP §5.7. |

## L. Third-Party, Vendor & Supply-Chain

| # | Document | Status | Notes for ADLA |
| --- | --- | --- | --- |
| L1 | Vendor / third-party register | To create | Hosting, SMS, email, managed data stores. |
| L2 | Vendor security due-diligence records | To create | Per provider. |
| L3 | Contracts & SLAs (incl. DPAs) | To create | **Needs vendor engagement** (see C9). |
| L4 | OSS / license compliance report | Drafted | `sbom.md` §3 — license distribution (~99% permissive); 2 UNKNOWN to confirm. |
| L5 | Supply-chain integrity controls | Partial | vuln/patch §1-2 + `deprecated-packages-migration.md`. |

## M. Physical & Environmental / Hosting

| # | Document | Status | Notes for ADLA |
| --- | --- | --- | --- |
| M1 | Hosting / data-center attestation | To create | **Obtain provider ISO 27001 / SOC 2** (covers most A.7 — see SoA). |
| M2 | Physical access control records (form offices) | To create | Offices handling physical declaration forms. |
| M3 | Environmental controls statement | To create | Usually satisfied by provider attestation. |
| M4 | Media handling & secure disposal records | Partial | Policy in data-classification §3 + acceptable-use; **records `[TBD]`**. |

## N. Human Resources & Awareness

| # | Document | Status | Notes for ADLA |
| --- | --- | --- | --- |
| N1 | Security awareness training & records | Drafted | `security-awareness-training-policy.md`; **material + completion records `[TBD]`**. |
| N2 | Confidentiality / NDA agreements | Drafted | `confidentiality-nda-agreement.md` (template); **signed copies + legal review `[TBD]`**. |
| N3 | Background-check / vetting policy & records | Drafted | `hr-security-policy.md` §2; **vetting records `[TBD]`**. |
| N4 | Disciplinary process for security violations | Drafted | hr-security §4 + ISP §7; formalize with HR `[TBD]`. |
| N5 | Onboarding/offboarding checklist | Drafted | hr-security §5 + ACP §5; checklist artifact `[TBD]`. |

## O. Deployment, Go-Live & Assurance

| # | Document | Status | Notes for ADLA |
| --- | --- | --- | --- |
| O1 | Pre-production / go-live security checklist | Exists | `production-checklist.md`. |
| O2 | Production readiness review / sign-off | To create | **Formal approval to deploy**. |
| O3 | Configuration baseline / hardening evidence (CIS) | To create | OS, containers, Postgres, Redis, MinIO, proxy. |
| O4 | Authorization to Operate (ATO) | To create | **Government accreditation decision**. |
| O5 | Residual-risk acceptance & sign-off | Partial | `risk-register.md` §3 log (template); **SIRO sign-off `[TBD]`**. |
| O6 | Audit response / evidence index | Drafted | **This document** — maps auditor request → evidence location. |

---

## Priority shortlist — remaining gaps (highest audit leverage)

The drafting is largely done. What remains most reliably blocks a public-sector
PII audit and needs **action, not authoring**:

1. **Management approval & named owners** — have the SIRO/DPO/ISO review, fill the
   `[TBD]` owners, and **formally approve** the drafted suite (A1, A6, all policies).
2. **Independent penetration test** + remediation/retest (G2, RR-20).
3. **DPC controller registration** (C2) and confirm the **lawful basis** (C6).
4. **Processor DPAs + vendor due diligence** (C9, L1-L3).
5. **Operationalize the controls that need evidence:**
   - Restore test + key-escrow recovery test (J2/J5, H5, RR-11/RR-13).
   - Access-review recertification records (E4).
   - Security-awareness training delivery + records, NDAs signed, vetting (N1-N3).
   - SIEM/alerting + NTP + uptime monitoring (I3-I5).
6. **Set the `[TBD]` numbers:** statutory retention periods (C12/B12), RPO/RTO
   (J4), remediation SLAs (B9), MFA + cookie-flag confirmation (B3/E6/E7).
7. **Close the residual-High risks** RR-02 (bucket exposure) and RR-05 (account
   takeover) — verify or formally accept before go-live.
8. **Production readiness sign-off / ATO** (O2, O4) and provider hosting
   attestation (M1).
9. **Remaining spec:** a standalone STRIDE threat model (G4). *(Architecture,
   topology, ERD, API catalogue, and SBOM — D1-D3/D5/D8 — are now drafted in
   `architecture.md`, `data-model.md`, `api-inventory.md`, `sbom.md`.)*

> **Strong position.** The codebase already implements most *technical* controls
> (PII encryption, audit logging, layered rate limiting, RBAC with officer
> scoping, secret startup gate, refresh-token replay detection), and the
> governance suite documenting them is now drafted. The path to audit-ready is
> review/approval, independent assurance, and operational evidence.

---

*This checklist is a planning aid, not legal advice. Confirm exact obligations
with the Data Protection Commission, the Cyber Security Authority, and the
engaged audit firm, and align document ownership and approval with your
organization's governance structure.*
