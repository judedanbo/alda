# Incident Response & Data-Breach Notification Plan — Asset Declaration Portal (ADLA)

> **Scaffold / working draft.** Operational plan for detecting, responding to,
> and reporting security incidents and personal-data breaches affecting ADLA.
> Aligned to **Data Protection Act, 2012 (Act 843)** breach-notification duties,
> the **Cybersecurity Act, 2020 (Act 1038)** incident-reporting regime
> (Cyber Security Authority / National CERT-GH), and NIST SP 800-61 incident
> handling. Pre-filled from the ADLA codebase; `[TBD]` items need the controller
> / ops owner to confirm.
>
> Companion documents: `docs/dpia.md` (risks R12 breach-detection, R3 ATO,
> R1/R2 PII exposure), `docs/ropa.md`, `docs/audit-documentation-checklist.md`,
> `docs/security-assessment.md`, `docs/production-checklist.md`.

---

## 0. Document control

| Field | Value |
| --- | --- |
| Version | 0.1 (draft) |
| Status | Draft for review |
| Owner | `[TBD]` (Information Security Officer) |
| Approver | `[TBD]` (accountable owner / SIRO) |
| Date created | 2026-06-03 |
| Review cadence | At least annually and after every Sev-1/Sev-2 incident or major change. |
| Last tested (tabletop/drill) | `[TBD]` |

---

## 1. Purpose & scope

**Purpose.** Ensure ADLA security incidents and personal-data breaches are
detected, contained, eradicated, recovered, reported to regulators and data
subjects within legal timeframes, and learned from.

**Scope.** The ADLA Nuxt application (`app/`), its data stores (PostgreSQL,
Redis, MinIO/object storage), supporting services (SMTP/email, SMS gateway),
hosting/infrastructure, and the staff/processors who operate them.

**Definitions.**
- **Security incident** — any event that actually or potentially compromises
  the confidentiality, integrity, or availability of ADLA or its data.
- **Personal-data breach** — a security incident leading to accidental or
  unlawful destruction, loss, alteration, unauthorized disclosure of, or access
  to, personal data (e.g. Ghana Card images, national-ID numbers, declarations).
- **CII** — Critical Information Infrastructure. **`[TBD]`: confirm whether ADLA
  is designated CII** under Act 1038 — if so, the CSA incident-reporting
  obligations and timelines in §6 apply.

---

## 2. Roles & responsibilities (Incident Response Team)

| Role | Responsibility | Owner |
| --- | --- | --- |
| Incident Manager / Coordinator | Owns the incident end-to-end; declares severity; drives the timeline. | `[TBD]` |
| Information Security Officer | Technical lead for triage, containment, forensics. | `[TBD]` |
| Data Protection Officer/Supervisor | Decides notifiability; drafts DPC & data-subject notifications. | `[TBD]` |
| System/Application owner | Application decisions, workarounds, service restoration. | `[TBD]` |
| Infrastructure/DevOps lead | Hosting, network, DB/object-store, backups/restore. | `[TBD]` |
| Communications/PR | External/public messaging, media. | `[TBD]` |
| Legal counsel | Regulatory/legal exposure, evidence, law enforcement liaison. | `[TBD]` |
| Executive sponsor (SIRO) | Authorizes major decisions, regulator/public disclosure. | `[TBD]` |

**On-call / contact list (24×7):** `[TBD]` — maintain out-of-band (not only in
ADLA), since the incident may take ADLA or its email offline.

---

## 3. Severity classification

| Severity | Definition (examples) | Target response |
| --- | --- | --- |
| **Sev-1 (Critical)** | Confirmed breach of Restricted-PII (Ghana Card images / national-ID numbers) at scale; object-store bucket exposed publicly; full DB compromise; admin-account takeover; ransomware; total outage. | Immediate; mobilize full IRT; notify exec sponsor now. |
| **Sev-2 (High)** | Suspected PII breach; single-account compromise with data access; auth bypass; targeted intrusion; PII leaked into logs/exports; partial outage affecting statutory deadlines. | Within 1 hour; mobilize IRT. |
| **Sev-3 (Medium)** | Contained abuse/attack with no confirmed data access; vulnerability actively exploited but blocked; isolated integrity issue. | Within 4 hours; ISO + system owner. |
| **Sev-4 (Low)** | Policy violation, near-miss, scanning/probing, single failed-login spike, minor misconfig with no exposure. | Next business day; track in register. |

> Any incident **involving personal data** is simultaneously assessed by the DPO
> for **breach notifiability** (§6) regardless of technical severity.

---

## 4. ADLA-specific detection sources & indicators

| Source | What it surfaces |
| --- | --- |
| `audit_logs` (`AuditLog`) — esp. `REFRESH_TOKEN_REPLAY_DETECTED` | Token theft / session replay → possible account takeover. |
| Auth lockout (`auth-lockout.ts`) spikes | Credential-stuffing / brute force. |
| Abuse subsystem (`AbuseEvent`, `EnforcementAction`) | Bot floods, scraping, abusive actors. |
| Rate-limit fallbacks firing (Redis degraded) | Possible DoS or infra failure. |
| `/api/health` failures / monitoring alerts | Availability incident. |
| Object-store (MinIO) access logs / public-read on `adla-uploads` | **Ghana Card image exposure** (DPIA R1). |
| Unexpected PII in `audit_logs` / CSV/PDF exports | PII-leakage incident (DPIA R5). |
| CSP violation reports (report-only/enforced) | XSS / injection attempts. |
| Startup-gate (`00.config-validation.ts`) refusal | Misconfigured/placeholder secrets reaching an environment. |
| Notification delivery anomalies (`NotificationDeliveryLog`) | Misdirected messages → potential disclosure. |
| Dependency/CVE alerts (SCA) | Vulnerable component (supply chain). |
| Third-party processor breach notice (email/SMS/host) | Upstream breach affecting ADLA data. |

---

## 5. Response lifecycle (NIST SP 800-61)

### 5.1 Prepare (pre-incident — standing)
- Maintain the out-of-band contact list, this plan, and access to backups/logs.
- Ensure audit logging, monitoring, and alerting are live (see `security-assessment.md`).
- Run periodic **tabletop drills** (§9). Verify **restore from backup** works (DPIA R9 / J2).

### 5.2 Detect & report
- Anyone detecting an issue reports to the Incident Manager via `[TBD: channel]`.
- Open an entry in the **incident register** (§8); start the **timeline log** (every action, timestamped — needed for regulator notification and forensics).

### 5.3 Triage & assess
- Incident Manager assigns **severity** (§3); DPO assesses **personal-data involvement** and starts the **breach-notifiability clock** (§6) at the moment of becoming aware.
- Preserve evidence **before** changing systems where feasible (snapshots, log exports, object-store access logs). Maintain chain of custody.

### 5.4 Contain
- **Short-term:** isolate affected components; revoke/rotate compromised credentials and tokens; for account takeover, wipe the refresh-token family and force re-auth; tighten/lock object-store bucket if exposed; block abusive actors via `ActorAccessRule`/enforcement; enable stricter rate limits.
- **Rotate secrets** if any may be exposed: `JWT_SECRET`, `JWT_REFRESH_SECRET`, `PII_ENCRYPTION_KEY`/`PII_HMAC_KEY` (note: rotating PII keys requires re-encryption — see key-management procedure `[TBD]`), MinIO creds, webhook secrets.
- **Long-term:** apply patches/fixes, harden config, deploy via the change process.

### 5.5 Eradicate
- Remove the root cause (malware, vulnerable dependency, misconfiguration, malicious rule/account). Validate via scan/test.

### 5.6 Recover
- Restore service from clean state/backups; verify data integrity; monitor closely for recurrence; confirm `/api/health` and key workflows. Define exit criteria before declaring resolved.

### 5.7 Post-incident review
- Within `[TBD: e.g. 5 business days]` hold a blameless review: timeline, root cause, what worked, gaps, and **corrective actions** (feed into the risk register / POA&M). Update this plan and controls. Record lessons in the register.

---

## 6. Breach notification — regulators & data subjects

> **The DPO owns the notification decision. Document the reasoning whether or
> not you notify.** Two regimes may apply in parallel:

### 6.1 Data Protection Commission (Act 843)

| Item | Position |
| --- | --- |
| Trigger | Personal data accessed/acquired/disclosed by/to an unauthorized person (Act 843 breach). |
| Who notifies | Data controller, via the DPO. |
| Timing | **As soon as reasonably practicable** after becoming aware. `[TBD]`: set an internal SLA (recommend ≤72h) and confirm current DPC guidance/portal. |
| Content | Nature of breach, data and subjects affected, likely consequences, measures taken/proposed, DPO contact. (See template §7.1.) |

### 6.2 Affected data subjects (Act 843)

| Item | Position |
| --- | --- |
| Trigger | Breach likely to cause harm to the individual (e.g. identity-document/national-ID exposure → high risk). |
| Timing | As soon as reasonably practicable, unless law enforcement requests delay. |
| Channel | Direct (email/SMS/letter) where feasible; public notice if direct contact impractical. (Template §7.2.) |
| Content | Plain-language description, likely consequences, protective steps, contact point. |

### 6.3 Cyber Security Authority / National CERT-GH (Act 1038)

| Item | Position |
| --- | --- |
| Trigger | Cybersecurity incident affecting the system — **especially if ADLA is designated CII** `[TBD]`. |
| Who notifies | The owner/operator, via ISO. |
| Timing | Per CSA directive — **`[TBD]`: confirm (CII operators are generally required to report within ~24h of detection)**. |
| Channel | CSA/CERT-GH reporting channel `[TBD]`. |

### 6.4 Other notifications (as applicable)

- **Law enforcement** (Ghana Police / EOCO) for criminal acts — `[TBD]`.
- **Affected processors/partners** (email, SMS, hosting). 
- **Audit Service / institutional stakeholders** per business agreements `[TBD]`.

### 6.5 Notification decision record (per incident)

| Question | Answer |
| --- | --- |
| Personal data involved? | |
| Categories & approx. number of subjects | |
| Likely consequences / risk of harm | |
| DPC notified? When? Ref. | |
| Data subjects notified? When? How? | |
| CSA/CERT-GH notified (if CII)? When? Ref. | |
| If not notifying any party — justification | |

---

## 7. Notification templates

### 7.1 DPC notification (template)
```
To: Data Protection Commission
From: [Controller], DPO [name/contact]
Date/Time of report:
Date/Time breach became known:
Date/Time breach occurred (if known):

1. Description of the breach (what happened, how discovered)
2. Categories of personal data affected (e.g. national-ID numbers, Ghana Card
   images, names, contact details, declaration records)
3. Approximate number of data subjects and records affected
4. Likely consequences for data subjects
5. Containment and remedial measures taken / planned
6. Whether data subjects have been / will be notified, and when
7. DPO contact for follow-up
```

### 7.2 Data-subject notification (template)
```
Subject: Important security notice about your ADLA account

We are writing to inform you of a security incident that may have affected
your personal information held in the Asset Declaration Portal.

- What happened: [plain-language summary]
- Information involved: [e.g. your Ghana Card image / ID number / contact details]
- What we have done: [containment / fixes]
- What you can do: [recommended protective steps]
- Contact: [support channel / DPO]

We take the protection of your information seriously and apologise for any
concern this may cause.
```

### 7.3 CSA / CERT-GH report (template)
```
Reporting entity / operator:
System: Asset Declaration Portal (ADLA) [CII designation: yes/no/TBD]
Incident detected (date/time):
Incident type: [intrusion / data breach / DoS / malware / misconfiguration]
Affected assets/services:
Indicators of compromise:
Current status: [contained / ongoing]
Impact (confidentiality/integrity/availability):
Actions taken:
Assistance requested:
Contact:
```

---

## 8. Incident register (log)

> Maintain even when empty — auditors expect the register to exist.

| ID | Date detected | Reporter | Summary | Severity | Personal data? | Containment | DPC notified | Subjects notified | CSA notified | Status | Closed date | Lessons / actions |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | | | | | | |

---

## 9. Testing & maintenance

| Activity | Frequency | Owner | Last done |
| --- | --- | --- | --- |
| Tabletop exercise (e.g. simulated Ghana Card image exposure) | `[TBD]` (≥ annually) | ISO | `[TBD]` |
| Contact-list verification | Quarterly `[TBD]` | Incident Manager | `[TBD]` |
| Backup restore test (supports recovery) | `[TBD]` | DevOps | `[TBD]` |
| Plan review & update | Annually + post-incident | Owner | 2026-06-03 |

---

## 10. Open items to finalize

1. Confirm whether ADLA is **CII** under Act 1038 (sets CSA timelines in §6.3).
2. Set internal notification **SLAs** and confirm current **DPC** and **CSA/CERT-GH** reporting channels.
3. Name the **IRT roles** and build the **out-of-band contact list**.
4. Define the **incident reporting channel** for staff.
5. Cross-link the **key-management procedure** (secret/key rotation steps in §5.4) once written.
6. Schedule and run the first **tabletop drill** and **restore test**.

---

*Working scaffold, not legal advice. Confirm exact notification obligations and
timelines with the Data Protection Commission, the Cyber Security Authority, and
legal counsel.*
