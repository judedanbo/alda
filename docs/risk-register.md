# Information Security Risk Register — Asset Declaration Portal (ADLA)

> **Scaffold / working draft — live document.** The single, owned record of
> ADLA's information-security and data-protection risks. Seeded from
> `docs/security-assessment.md` (technical findings), `docs/dpia.md` (privacy
> risks R1–R12), and the policy suite. Aligned to **ISO/IEC 27001:2022 Clause 6
> / A-controls**. `[TBD]` items (owners, dates, residual acceptance) need
> management input.
>
> Master index: `docs/audit-documentation-checklist.md`.

---

## 0. Document control

| Field | Value |
| --- | --- |
| Version | 0.1 (draft) |
| Status | Live register — review continuously |
| Owner | `[TBD]` (Information Security Officer) |
| Approver / risk-acceptance authority | `[TBD]` (SIRO / executive owner) |
| Date created | 2026-06-03 |
| Review cadence | At least monthly while open items remain; on every Sev-1/2 incident. |

---

## 1. Scoring method

- **Likelihood**: 1 Rare · 2 Unlikely · 3 Possible · 4 Likely · 5 Almost certain
- **Impact**: 1 Negligible · 2 Minor · 3 Moderate · 4 Major · 5 Severe
- **Risk score** = Likelihood × Impact. Bands: **1–4 Low** · **5–9 Medium** ·
  **10–14 High** · **15–25 Critical**.
- **Inherent** = before controls; **Residual** = after implemented controls.
- **Treatment**: Mitigate · Accept · Transfer · Avoid.

> Many controls are **already implemented** (see `security-assessment.md` /
> `production-checklist.md`), so several residual scores are materially lower
> than inherent. Items still showing High/Critical residual are the launch
> blockers.

---

## 2. Risk register

| ID | Risk | Source | Inherent (L×I) | Key controls (existing + needed) | Residual (L×I) | Treatment | Owner | Status / due |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RR-01 | Hardcoded fallback secrets reach production | SA C-1 | 4×5 = **20 Crit** | Startup gate `00.config-validation.ts` rejects missing/placeholder secrets | 1×5 = **5 Med** | Mitigate (done) | `[TBD]` | Verify in prod |
| RR-02 | Ghana Card images exposed via public object store | SA C-4/M-6, DPIA R1 | 4×5 = **20 Crit** | Private bucket, no public-read ACL, randomized names, TLS; post-deploy bucket check | 2×5 = **10 High** | Mitigate | `[TBD]` | Verify; monitor |
| RR-03 | National-ID numbers exposed (DB/export) | SA C-5, DPIA R2 | 4×5 = **20 Crit** | AES-256-GCM field encryption + HMAC; keep IDs out of logs/exports | 2×4 = **8 Med** | Mitigate | `[TBD]` | Export hygiene `[TBD]` |
| RR-04 | PII leaks into audit logs / CSV/PDF exports | SA, DPIA R5 | 4×4 = **16 Crit** | Field allow-listing/redaction in audit & export paths | 2×4 = **8 Med** | Mitigate | `[TBD]` | Implement+verify |
| RR-05 | Account takeover via token/credential theft | SA, DPIA R3 | 4×5 = **20 Crit** | bcrypt, lockout, refresh rotation + replay detection; cookie `HttpOnly`/`Secure`; MFA `[TBD]` | 2×5 = **10 High** | Mitigate | `[TBD]` | Confirm cookies/MFA |
| RR-06 | Spoofed `X-Forwarded-For` defeats rate-limit/abuse/audit IP | SA | 4×3 = **12 High** | `ANALYTICS_TRUSTED_PROXIES` allow-list; socket-peer default | 2×3 = **6 Med** | Mitigate | `[TBD]` | Set proxy CIDRs |
| RR-07 | Rate limiting fails open on Redis error (incl. auth) | SA H-1 | 3×4 = **12 High** | Per-process fail-closed fallback caps | 2×3 = **6 Med** | Mitigate (done) | `[TBD]` | Verify |
| RR-08 | Missing security response headers (CSP/HSTS/etc.) | SA | 3×3 = **9 Med** | `01.security-headers.ts`; `SECURITY_CSP_ENFORCE` after validation | 2×2 = **4 Low** | Mitigate | `[TBD]` | Flip CSP enforce |
| RR-09 | File upload accepts spoofed MIME / unsafe content | SA | 3×4 = **12 High** | Magic-byte validation, private ACL, randomized names | 2×3 = **6 Med** | Mitigate | `[TBD]` | Confirm controls |
| RR-10 | Over-broad internal access / IDOR | DPIA R4 | 3×4 = **12 High** | RBAC role prefixes + `UserCollectionOffice` scoping + IDOR checks; access reviews `[TBD]` | 2×4 = **8 Med** | Mitigate | `[TBD]` | Access-review records |
| RR-11 | Loss of PII encryption key → data unrecoverable | DPIA R11 | 2×5 = **10 High** | Key-management procedure; **K1/K2 escrow + recovery test** | 1×5 = **5 Med** | Mitigate | `[TBD]` | Stand up escrow |
| RR-12 | Breach not detected/notified within legal time | DPIA R12 | 3×4 = **12 High** | IR + breach-notification plan (DPC/CSA timelines); monitoring/alerting | 2×4 = **8 Med** | Mitigate | `[TBD]` | Test IR plan |
| RR-13 | Loss of availability → missed statutory deadlines | DPIA R9 | 3×3 = **9 Med** | Backup + DR plan with RPO/RTO; tested restore; `/api/health` monitoring | 2×3 = **6 Med** | Mitigate | `[TBD]` | Perform restore test |
| RR-14 | Excessive data collection / over-retention | DPIA R6/R7 | 3×3 = **9 Med** | Minimization review; `DataRetentionPolicy` + prune; statutory periods `[TBD]` | 2×2 = **4 Low** | Mitigate | `[TBD]` | Set retention periods |
| RR-15 | Vulnerable third-party dependency (supply chain) | SA, deprecated-pkgs plan | 3×4 = **12 High** | SCA/dependency scanning, patch SLA, SBOM | 2×3 = **6 Med** | Mitigate | `[TBD]` | Stand up scanning |
| RR-16 | Processor (SMS/email/host) breach or non-compliance | DPIA, RoPA | 3×4 = **12 High** | Vendor due diligence + DPAs; data minimization in comms | 2×3 = **6 Med** | Mitigate | `[TBD]` | Sign DPAs |
| RR-17 | Cross-border transfer without safeguard | DPIA C10 | 3×4 = **12 High** | Transfer assessment + safeguards / Ghana-only hosting | `[TBD]` | Mitigate/Avoid | `[TBD]` | Assess hosting locale |
| RR-18 | Re-identification via analytics/IP tracking | DPIA R10 | 2×3 = **6 Med** | Salted IP hashing, DNT honoured, retention prune | 1×2 = **2 Low** | Mitigate (done) | `[TBD]` | — |
| RR-19 | Insider misuse of privileged (`admin`) access | Policy/E3 | 3×4 = **12 High** | Least privilege, audit logging, access review, vetting/NDA `[TBD]` | 2×3 = **6 Med** | Mitigate | `[TBD]` | PAM + reviews |
| RR-20 | No independent assurance before go-live | Audit checklist G2 | 3×4 = **12 High** | Independent penetration test + remediation/retest | `[TBD]` | Mitigate | `[TBD]` | Commission pentest |

---

## 3. Treatment & acceptance log

| Risk ID | Decision | Residual accepted by | Date | Conditions / review date |
| --- | --- | --- | --- | --- |
| | | | | |

> Any risk with **High/Critical residual** at go-live must be explicitly
> **accepted in writing** by the SIRO (see `docs/audit-documentation-checklist.md`
> O5), or treated down first. Items RR-02 and RR-05 currently sit at residual
> **High** pending verification — close or formally accept before launch.

---

## 4. How this register is maintained

- New risks (from incidents, pentests, scans, audits, changes) are added here
  with an owner and treatment.
- Ties to the **POA&M / remediation tracker** for the `security-assessment.md`
  findings; each finding's closure updates the corresponding residual score.
- Reviewed at management review; status reported to the SIRO.

---

## 5. Open items to finalize

1. Assign an **owner** and **due date** to every open risk.
2. Verify/close the residual **High** items (RR-02, RR-05) before go-live.
3. Resolve `[TBD]` residuals (RR-17 transfers, RR-20 pentest) once those
   activities complete.
4. Record formal **residual-risk acceptance** (§3) at the production sign-off.

---

*Working scaffold, not legal advice. Validate scoring and acceptance with
management; this register should become a living artifact, not a one-off.*
