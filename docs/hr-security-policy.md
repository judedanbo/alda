# Human Resources Security Policy — Asset Declaration Portal (ADLA)

> **Scaffold / working draft.** Security controls across the employment
> lifecycle for people with ADLA access. Closes SoA controls **6.1 (screening),
> 6.2 (terms), 6.4 (disciplinary), 6.5 (post-termination/change)**; ties to
> **6.3** (awareness), **6.6** (NDA), and ACP §5 (JML). Derives from
> `docs/information-security-policy.md`.

---

## 0. Document control

| Field | Value |
| --- | --- |
| Version | 0.1 (draft) |
| Owner | `[TBD]` (HR + Information Security Officer) |
| Approved by | `[TBD]` |
| Date created | 2026-06-03 |
| Review | Annually / on change. |

---

## 1. Purpose & scope

Ensure people with access to ADLA are suitable, understand their security
obligations, and have access aligned to their role throughout joining, moving,
and leaving. Applies to all staff, officers, and contractors — with heightened
diligence for roles touching Restricted-PII (`admin`, `legal_unit`,
`schedule_officer`) (RR-19).

## 2. Before employment — screening (6.1)

- **Pre-engagement vetting** proportionate to role sensitivity `[TBD]`:
  identity verification, references, and — for privileged/PII-handling roles —
  background/criminal-record checks per Ghanaian law and Act 843 limits.
- Verify qualifications/authority for officer roles.
- Re-screen on promotion into a privileged role `[TBD]`.
- Records of screening retained by HR, minimized and protected.

## 3. Terms & conditions of employment (6.2)

- Employment/contract terms include **information-security and data-protection
  responsibilities** and reference this policy, the Acceptable Use Policy, and
  the confidentiality/NDA agreement.
- Obligations that **survive termination** are stated explicitly (confidentiality,
  return of assets).
- Contractors/processors carry equivalent obligations via contract (supplier
  controls 5.19–5.20).

## 4. During employment

- Complete **security-awareness training** on joining and periodically
  (awareness policy, 6.3).
- Access granted per the **Access Control Policy** (role + office scope), via the
  approval workflow, least privilege.
- **Disciplinary process (6.4):** a defined, fair process for security/data
  violations, proportionate to severity (e.g. unauthorized PII access),
  potentially up to dismissal and referral to authorities for unlawful acts.
  Triggered via the incident process where relevant.

## 5. Change or termination of employment (6.5)

| Event | Action | Owner |
| --- | --- | --- |
| Role change (mover) | Re-evaluate and **adjust access** to the new role; remove no-longer-needed rights; re-screen if entering privileged role. | HR + ISO |
| Leaving (leaver) | **Disable ADLA access same day**; revoke tokens/sessions; remove role/office assignments; transfer custody of any keys held. | HR + DevOps/ISO |
| Either | **Return of assets** (devices, badges, documents, physical forms); remind of surviving confidentiality obligations. | HR |

JML mechanics align with `docs/access-control-policy.md` §5; access changes are
recorded in the access register `[TBD]`.

## 6. Records

HR retains screening, acknowledgement, training, and JML records — minimized,
access-controlled, and retained per the retention policy.

## 7. Open items

1. Define **screening standards** per role and the privileged-role threshold.
2. Add **security/data-protection clauses** to employment/contractor templates.
3. Formalize the **disciplinary process** for security violations.
4. Implement the **same-day leaver disable** and asset-return checklist with HR/DevOps.

---

*Working scaffold, not legal advice. Align screening and disciplinary measures
with Ghanaian employment law and Act 843.*
