# Statement of Applicability (SoA) — Asset Declaration Portal (ADLA)

> **Scaffold / working draft.** Maps every **ISO/IEC 27001:2022 Annex A**
> control (93 controls across 4 themes) to ADLA: whether it applies, its
> implementation status, and the justification/evidence. Seeded from the ADLA
> codebase and the policy suite. `[TBD]` and "Planned" items need owner action.
>
> Master index: `docs/audit-documentation-checklist.md`. Risk linkage:
> `docs/risk-register.md`.

---

## 0. Document control

| Field | Value |
| --- | --- |
| Version | 0.1 (draft) |
| Owner | `[TBD]` (Information Security Officer) |
| Approved by | `[TBD]` (SIRO) |
| Date created | 2026-06-03 |
| Review cadence | On control/risk change; at least annually. |
| ISMS scope | The ADLA Nuxt application (`app/`), its data stores (PostgreSQL, Redis, object storage), supporting services (email, SMS), hosting, and operators. |

**Status legend:** `Implemented` · `Partial` (controls exist, not fully
operationalized/documented) · `Planned` (applicable, not yet in place) ·
`N/A` (justified exclusion).

**Reference shorthand:** ISP = information-security-policy.md · ACP =
access-control-policy.md · KMP = key-management-procedure.md · IRP =
incident-response-plan.md · BDR = backup-dr-plan.md · DSAR = dsar-procedure.md ·
SA = security-assessment.md · PC = production-checklist.md · RR = risk-register.md.

---

## A.5 Organizational controls (37)

| Ctrl | Title | Applies | Status | Justification / evidence |
| --- | --- | --- | --- | --- |
| 5.1 | Policies for information security | Yes | Partial | ISP (apex) + suite drafted; need management approval & full B-series. |
| 5.2 | Information security roles & responsibilities | Yes | Partial | Roles defined in ISP §5, ACP; names `[TBD]`. |
| 5.3 | Segregation of duties | Yes | Implemented | Workflow separates applicant/officer/legal/admin; ACP §2. |
| 5.4 | Management responsibilities | Yes | Planned | Needs management-review records & sign-off. |
| 5.5 | Contact with authorities | Yes | Partial | DPC/CSA-CERT contacts in IRP §6; confirm channels `[TBD]`. |
| 5.6 | Contact with special interest groups | Yes | Planned | Establish CSA/CERT-GH / security-community links. |
| 5.7 | Threat intelligence | Yes | Partial | Abuse detection + CVE/SCA feeds; formalize intake `[TBD]`. |
| 5.8 | Information security in project management | Yes | Partial | Security built into the build (SA, plans); document the gate. |
| 5.9 | Inventory of information & associated assets | Yes | Partial | Data inventory in DPIA App.A / RoPA; business asset register `[TBD]`. |
| 5.10 | Acceptable use of information & assets | Yes | Planned | Acceptable Use Policy to be written. |
| 5.11 | Return of assets | Yes | Planned | Part of JML/offboarding `[TBD]`. |
| 5.12 | Classification of information | Yes | Partial | Tiers referenced (Restricted-PII etc.); Data Classification Policy `[TBD]`. |
| 5.13 | Labelling of information | Yes | Planned | Define labelling for exports/records. |
| 5.14 | Information transfer | Yes | Partial | TLS in transit; comms-minimization (no PII in email/SMS); policy `[TBD]`. |
| 5.15 | Access control | Yes | Implemented | RBAC + officer scoping; ACP; `auth.ts` middleware. |
| 5.16 | Identity management | Yes | Implemented | `User`/`Role`/`UserRole`; unique accounts. |
| 5.17 | Authentication information | Yes | Implemented | bcrypt, lockout, token rotation/replay; ACP §4; MFA `[TBD]`. |
| 5.18 | Access rights | Yes | Partial | Granting enforced in code; periodic review records `[TBD]` (RR-10). |
| 5.19 | InfoSec in supplier relationships | Yes | Planned | Vendor register + due diligence `[TBD]` (RR-16). |
| 5.20 | Addressing InfoSec in supplier agreements | Yes | Planned | DPAs/SLAs with email/SMS/host `[TBD]`. |
| 5.21 | Managing InfoSec in the ICT supply chain | Yes | Partial | Dependency mgmt (lockfile, deprecated-pkgs plan); SBOM `[TBD]` (RR-15). |
| 5.22 | Monitoring & change of supplier services | Yes | Planned | Define processor review cadence. |
| 5.23 | InfoSec for use of cloud services | Yes | Partial | Hosting/object-store config (PC); cloud-security review `[TBD]`. |
| 5.24 | Incident management planning & preparation | Yes | Implemented | IRP. |
| 5.25 | Assessment & decision on security events | Yes | Implemented | IRP §3/§5.3 severity & triage. |
| 5.26 | Response to security incidents | Yes | Implemented | IRP §5. |
| 5.27 | Learning from security incidents | Yes | Implemented | IRP §5.7 post-incident review. |
| 5.28 | Collection of evidence | Yes | Partial | IRP §5.3 evidence preservation; forensic-readiness detail `[TBD]`. |
| 5.29 | Information security during disruption | Yes | Implemented | BDR §5; IRP. |
| 5.30 | ICT readiness for business continuity | Yes | Partial | BDR (RPO/RTO `[TBD]`, restore test pending) (RR-13). |
| 5.31 | Legal, statutory, regulatory & contractual reqs | Yes | Partial | Act 843/1038/772, Article 286 mapped across DPIA/RoPA/IRP; compliance register `[TBD]`. |
| 5.32 | Intellectual property rights | Yes | Partial | OSS license inventory `[TBD]`. |
| 5.33 | Protection of records | Yes | Implemented | Audit logs, retention policy, encryption; declarations as protected records. |
| 5.34 | Privacy & protection of PII | Yes | Implemented | DPIA, RoPA, DSAR, PII encryption; DPC registration `[TBD]`. |
| 5.35 | Independent review of information security | Yes | Partial | SA (internal); **independent pentest `[TBD]`** (RR-20). |
| 5.36 | Compliance with policies/standards | Yes | Planned | Internal audit/compliance checks `[TBD]`. |
| 5.37 | Documented operating procedures | Yes | Partial | PC runbook + CLAUDE.md; full ops runbook `[TBD]`. |

## A.6 People controls (8)

| Ctrl | Title | Applies | Status | Justification / evidence |
| --- | --- | --- | --- | --- |
| 6.1 | Screening | Yes | Planned | Vetting for admin/legal/officer roles `[TBD]` (RR-19). |
| 6.2 | Terms & conditions of employment | Yes | Planned | Include security obligations in contracts `[TBD]`. |
| 6.3 | Awareness, education & training | Yes | Planned | Security-awareness programme + records `[TBD]`. |
| 6.4 | Disciplinary process | Yes | Partial | Referenced in ISP §7; formal process `[TBD]`. |
| 6.5 | Responsibilities after termination/change | Yes | Planned | JML offboarding (ACP §5) `[TBD]`. |
| 6.6 | Confidentiality / NDA agreements | Yes | Planned | NDAs for staff/contractors with PII access `[TBD]`. |
| 6.7 | Remote working | Yes | Planned | Remote-access policy if officers work off-site `[TBD]`. |
| 6.8 | Information security event reporting | Yes | Partial | IRP §5.2 reporting; staff channel `[TBD]`. |

## A.7 Physical controls (14)

| Ctrl | Title | Applies | Status | Justification / evidence |
| --- | --- | --- | --- | --- |
| 7.1 | Physical security perimeters | Yes (inherited) | Partial | Hosting in provider data center; obtain provider attestation `[TBD]`. |
| 7.2 | Physical entry | Yes (inherited) | Partial | Provider DC controls; form-collection offices `[TBD]`. |
| 7.3 | Securing offices, rooms & facilities | Yes | Partial | Offices storing physical declaration forms `[TBD]`. |
| 7.4 | Physical security monitoring | Yes (inherited) | Partial | Provider attestation `[TBD]`. |
| 7.5 | Protecting against physical/environmental threats | Yes (inherited) | Partial | Provider attestation `[TBD]`. |
| 7.6 | Working in secure areas | Partial | Planned | Where physical forms handled `[TBD]`. |
| 7.7 | Clear desk & clear screen | Yes | Planned | Policy for offices handling forms/PII `[TBD]`. |
| 7.8 | Equipment siting & protection | Yes (inherited) | Partial | Provider DC `[TBD]`. |
| 7.9 | Security of assets off-premises | Partial | Planned | If officers use mobile/field devices `[TBD]`. |
| 7.10 | Storage media | Yes | Partial | Scanned letters/printed receipts; media-handling policy `[TBD]`. |
| 7.11 | Supporting utilities | Yes (inherited) | Partial | Provider DC `[TBD]`. |
| 7.12 | Cabling security | Yes (inherited) | Partial | Provider DC `[TBD]`. |
| 7.13 | Equipment maintenance | Yes (inherited) | Partial | Provider DC `[TBD]`. |
| 7.14 | Secure disposal or re-use of equipment | Yes | Planned | Media disposal records `[TBD]`. |

> Physical controls are largely **inherited from the hosting provider** — obtain
> its ISO 27001 / SOC 2 attestation as evidence (audit checklist M1). Offices
> handling **physical declaration forms** require directly-owned controls.

## A.8 Technological controls (34)

| Ctrl | Title | Applies | Status | Justification / evidence |
| --- | --- | --- | --- | --- |
| 8.1 | User endpoint devices | Yes | Planned | Endpoint policy for staff devices `[TBD]`. |
| 8.2 | Privileged access rights | Yes | Partial | `admin` scoped + audit-logged; PAM/reviews `[TBD]` (RR-19). |
| 8.3 | Information access restriction | Yes | Implemented | RBAC + officer scoping + IDOR checks; ACP. |
| 8.4 | Access to source code | Yes | Partial | Git repo access controls; document branch/PR gates `[TBD]`. |
| 8.5 | Secure authentication | Yes | Implemented | JWT, bcrypt, lockout, refresh rotation/replay; MFA `[TBD]`. |
| 8.6 | Capacity management | Yes | Partial | Queue concurrency tunables (PC); capacity plan `[TBD]`. |
| 8.7 | Protection against malware | Yes | Partial | Upload validation; host AV/hardening `[TBD]`. |
| 8.8 | Management of technical vulnerabilities | Yes | Partial | SA findings + deprecated-pkgs plan; SCA + patch SLA `[TBD]` (RR-15). |
| 8.9 | Configuration management | Yes | Implemented | `.env.example` + startup gate (`00.config-validation.ts`); PC; baselines `[TBD]`. |
| 8.10 | Information deletion | Yes | Partial | Retention prune + archival; DSAR erasure (statutory limits). |
| 8.11 | Data masking | Yes | Implemented | PII field encryption + IP hashing; redact PII in logs/exports (RR-04). |
| 8.12 | Data leakage prevention | Yes | Partial | Comms minimization, private buckets; export hygiene `[TBD]` (RR-04). |
| 8.13 | Information backup | Yes | Partial | BDR (tooling/restore test `[TBD]`) (RR-13). |
| 8.14 | Redundancy of processing facilities | Yes | Planned | DR target/failover `[TBD]` (BDR §5). |
| 8.15 | Logging | Yes | Implemented | `audit_logs` (durable BullMQ), traffic/abuse events. |
| 8.16 | Monitoring activities | Yes | Partial | Abuse scorer, `/api/health`; SIEM/alerting `[TBD]`. |
| 8.17 | Clock synchronization | Yes | Planned | NTP standard for log defensibility `[TBD]`. |
| 8.18 | Use of privileged utility programs | Yes | Partial | DB/object-store admin tooling restricted `[TBD]`. |
| 8.19 | Installation of software on operational systems | Yes | Implemented | Deploy via CI/images; controlled. |
| 8.20 | Networks security | Yes | Implemented | Rate limiting, security headers, trusted-proxy handling (`00.security.ts`). |
| 8.21 | Security of network services | Yes | Partial | TLS; service segmentation `[TBD]`. |
| 8.22 | Segregation of networks | Yes | Partial | Trust zones/private services; document topology `[TBD]`. |
| 8.23 | Web filtering | Partial | N/A-ish | Inbound abuse/AI-crawler policy in `00.security.ts`; outbound filtering N/A (server app). |
| 8.24 | Use of cryptography | Yes | Implemented | KMP; AES-256-GCM PII, TLS; key escrow `[TBD]` (RR-11). |
| 8.25 | Secure development life cycle | Yes | Partial | Review/lint/tests; documented SSDLC `[TBD]`. |
| 8.26 | Application security requirements | Yes | Implemented | Zod validation, authz checks, SA-driven hardening. |
| 8.27 | Secure system architecture & engineering principles | Yes | Implemented | Layered middleware, singleton Prisma, fail-safe defaults (CLAUDE.md). |
| 8.28 | Secure coding | Yes | Implemented | Parameterized Prisma, escaped templates, central validators; standard doc `[TBD]`. |
| 8.29 | Security testing in development & acceptance | Yes | Partial | Vitest/Playwright; security test cases + **pentest `[TBD]`** (RR-20). |
| 8.30 | Outsourced development | No | N/A | Developed in-house `[TBD]` — confirm. |
| 8.31 | Separation of dev/test/prod | Yes | Partial | Dev compose vs prod; document & enforce no-real-PII in non-prod `[TBD]`. |
| 8.32 | Change management | Yes | Partial | Git/PR + migrations; formal change procedure `[TBD]`. |
| 8.33 | Test information | Yes | Partial | Seeds use synthetic data; ensure no prod PII in tests `[TBD]`. |
| 8.34 | Protection of info systems during audit testing | Yes | Planned | Agree scope/rules for the upcoming audit/pentest `[TBD]`. |

---

## 1. Summary of gaps (to drive the plan)

**Strong / Implemented:** access control & identity (5.15-5.18, 8.3, 8.5),
cryptography (8.24), logging (8.15), network security (8.20), secure
architecture/coding (8.26-8.28), incident management (5.24-5.27), records &
PII protection (5.33-5.34).

**Top gaps to close before audit/go-live:**
1. **Independent review / security testing** — 5.35, 8.29, 8.34 (pentest, RR-20).
2. **People controls** — 6.1-6.7 (screening, training, NDAs, JML) almost entirely Planned.
3. **Supplier management** — 5.19-5.23 (DPAs, vendor due diligence, SBOM).
4. **Backup/DR operationalization** — 5.30, 8.13-8.14 (restore test, DR target).
5. **Policy completion & approval** — 5.1, 5.10, 5.12 (Acceptable Use, Data Classification) + management review 5.4.
6. **Monitoring/ops** — 8.16-8.17 (SIEM/alerting, NTP), 5.37 ops runbook.
7. **Physical attestation** — A.7 (provider ISO/SOC report) + form-office controls.

---

## 2. Open items to finalize

1. Confirm each `N/A` exclusion (8.30 outsourced dev) with justification.
2. Assign an **owner** and **target date** to every `Planned`/`Partial` control.
3. Attach **evidence references** as artifacts are produced.
4. Have the **SIRO approve** the SoA alongside the risk register.

---

*Working scaffold, not legal advice. Validate applicability decisions and
evidence with the ISO and your audit firm; the SoA must be approved and kept
current.*
