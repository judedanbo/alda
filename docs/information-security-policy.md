# Information Security Policy — Asset Declaration Portal (ADLA)

> **Scaffold / working draft.** The apex security policy from which the rest of
> the ADLA policy suite derives. Aligned to **ISO/IEC 27001:2022**, the
> **Data Protection Act, 2012 (Act 843)**, and the **Cybersecurity Act, 2020
> (Act 1038)**. `[TBD]` items need management/owner confirmation.
>
> Part of the suite: `docs/access-control-policy.md`, `docs/risk-register.md`,
> `docs/dpia.md`, `docs/ropa.md`, `docs/incident-response-plan.md`,
> `docs/key-management-procedure.md`, `docs/dsar-procedure.md`,
> `docs/backup-dr-plan.md`. Master index: `docs/audit-documentation-checklist.md`.

---

## 0. Document control

| Field | Value |
| --- | --- |
| Version | 0.1 (draft) |
| Status | Draft for management approval |
| Owner | `[TBD]` (Information Security Officer) |
| Approved by | `[TBD]` (accountable owner / SIRO / executive) |
| Date created | 2026-06-03 |
| Review cadence | At least annually and on significant change. |

---

## 1. Purpose

Establish management's commitment and direction for protecting the
confidentiality, integrity, and availability (CIA) of information processed by
ADLA — a public-internet government system handling national-identity data
(Ghana Card numbers and images) and asset declarations under **Article 286(5)**
of the 1992 Constitution.

## 2. Scope

Applies to:
- The ADLA application (`app/`), its data stores (PostgreSQL, Redis, object
  storage), and supporting services (email, SMS, hosting).
- All personal and operational data processed by ADLA (see `docs/ropa.md`).
- All people with access: employees, officers (Schedule Officer, Legal Unit,
  Admin), contractors, and processors.
- All environments (development, staging, production) and access locations.

## 3. Policy statements

Management commits to:

1. **Protect information** per its classification, with the strongest controls
   on Restricted-PII (national-ID numbers, Ghana Card images).
2. **Comply** with Act 843, Act 1038, the Electronic Transactions Act (Act 772),
   and Article 286 obligations.
3. **Manage risk** through a documented, regularly reviewed risk process
   (`docs/risk-register.md`).
4. **Enforce least privilege and role-based access** (`docs/access-control-policy.md`).
5. **Encrypt** Restricted-PII at rest and all sensitive data in transit
   (`docs/key-management-procedure.md`).
6. **Log and monitor** security-relevant events and maintain an audit trail as a
   compliance requirement.
7. **Detect, respond to, and report** incidents and personal-data breaches within
   legal timeframes (`docs/incident-response-plan.md`).
8. **Maintain availability** through backup and disaster recovery
   (`docs/backup-dr-plan.md`).
9. **Build security into development** (secure SDLC, code review, dependency
   management, validation).
10. **Hold people accountable** through training, confidentiality agreements, and
    a disciplinary process for violations.
11. **Continually improve** the ISMS through review, internal audit, and
    corrective action.

## 4. Information security objectives

| Objective | Measure (`[TBD]` targets) |
| --- | --- |
| No unauthorized disclosure of Restricted-PII | Zero confirmed PII breaches; bucket-privacy checks pass. |
| Strong authentication & access control | 100% role-scoped endpoints; periodic access reviews completed. |
| Timely patching | Critical vulns remediated within `[TBD]` days. |
| Recoverability | Restore + key-escrow recovery tests pass at agreed cadence. |
| Incident readiness | IR plan tested ≥ annually; breaches reported within SLA. |
| Compliance | DPC registration current; DPIA/RoPA maintained. |

## 5. Roles & responsibilities

| Role | Responsibility |
| --- | --- |
| Executive owner / SIRO | Accountable for information risk; approves this policy and residual-risk acceptance. |
| Information Security Officer (ISO) | Owns the ISMS, policies, risk register, and security operations. |
| Data Protection Officer/Supervisor | Owns data-protection compliance, DPIA/RoPA, DSAR, breach notification. |
| System/Application owner | Day-to-day security of ADLA; prioritizes remediation. |
| Infrastructure/DevOps | Implements technical controls, backups, secrets, monitoring. |
| All staff & officers | Follow policy, complete training, report incidents, protect credentials. |
| Processors/vendors | Meet contractual security and data-protection obligations. |

## 6. Supporting policies & procedures

This policy is implemented through the documents in the suite (access control,
cryptography/key management, logging & monitoring, backup/DR, incident response,
secure development, data classification & retention, acceptable use, etc.).
Gaps and statuses are tracked in `docs/audit-documentation-checklist.md`.

## 7. Compliance & enforcement

- Compliance is mandatory. Violations may lead to disciplinary action `[TBD]`
  and, where unlawful, legal consequences.
- Compliance is verified through monitoring, internal audit, and management
  review.
- Exceptions require documented risk acceptance by the executive owner.

## 8. Review

Reviewed at least annually, and after major incidents, regulatory change, or
significant architecture change. Changes are versioned and re-approved.

---

*Working scaffold, not legal advice. Adopt, tailor, and have management formally
approve before relying on it for audit.*
