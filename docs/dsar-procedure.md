# Data Subject Rights (DSAR) Procedure — Asset Declaration Portal (ADLA)

> **Scaffold / working draft.** How ADLA receives, verifies, and fulfils data
> subject rights requests under the **Data Protection Act, 2012 (Act 843)**.
> Pre-filled from the ADLA codebase; `[TBD]` items need the controller / Data
> Protection Supervisor to confirm.
>
> Companion documents: `docs/ropa.md` (data inventory & lawful bases),
> `docs/dpia.md` (§4.3 rights matrix), `docs/audit-documentation-checklist.md`.

---

## 0. Document control

| Field | Value |
| --- | --- |
| Version | 0.1 (draft) |
| Status | Draft for review |
| Owner | `[TBD]` (Data Protection Officer / Supervisor) |
| Approver | `[TBD]` (accountable owner) |
| Date created | 2026-06-03 |
| Review cadence | Annually or on legal/process change. |

---

## 1. Purpose & scope

**Purpose.** Provide a consistent, lawful, timely process for handling requests
from data subjects to exercise their rights over personal data held in ADLA.

**Scope.** All personal data processed by ADLA (see `docs/ropa.md`): applicant
profiles, national-ID data, Ghana Card images, declaration records, contact
details, notification and audit metadata.

**Who can request.** Applicants (public officers), staff users, and members of
the public who have submitted personal data (e.g. contact submissions), or an
authorized representative acting on their behalf.

---

## 2. Rights covered (Act 843)

| Right | What ADLA must do | ADLA notes & limits |
| --- | --- | --- |
| **Access** | Confirm whether we process their data and provide a copy + processing details. | Assemble from `ApplicantProfile`, `Declaration`/history, notifications, etc. National-ID returned in plain form **only** to the verified subject. |
| **Rectification / correction** | Correct inaccurate or incomplete data. | Self-service profile edit + officer verification; post-submission corrections follow the workflow. |
| **Erasure** | Delete data where there is no lawful basis to keep it. | **Limited by statutory retention** — declaration records under Article 286(5) are compliance records and generally cannot be erased on request while retention applies. Document the refusal basis. |
| **Restriction of processing** | Limit processing in defined situations (e.g. accuracy disputed). | Flag/hold the record; `[TBD]` operational mechanism. |
| **Objection** | Stop processing based on legitimate interest / public task where grounds outweigh. | Most ADLA processing rests on legal obligation/public task → limited objection scope; analytics (legitimate interest) can be honoured. |
| **Withdraw consent** | Where processing relied on consent. | Largely N/A (statutory basis), but applies to any optional notification preferences. |
| **Portability** | Provide data in a structured, machine-readable form. | Likely N/A under legal-obligation basis; confirm `[TBD]`. |
| **Rights re automated decisions** | Not be subject to solely automated decisions with legal/significant effect. | ADLA makes **no determinative automated decisions** on individuals; abuse-scoring only rate-limits/blocks traffic. Confirm `[TBD]`. |

---

## 3. How requests are received

| Channel | Notes |
| --- | --- |
| Privacy/contact page or DPO email | `[TBD]` — publish a clear address on the `/privacy` page. |
| In-app request | `[TBD]` — optional future feature. |
| Verbal/written to staff | Staff must forward to the DPO promptly and log receipt. |

A request is **valid** however it is phrased — there is no required form. Staff
must recognize and escalate any request to exercise rights, even informal ones.

---

## 4. Identity verification

Before disclosing or changing personal data, verify the requester is the data
subject (or authorized representative) to prevent disclosure to an impostor
(DPIA-aligned: prevents unauthorized PII disclosure).

- Verify via the **authenticated account** where possible (logged-in applicant).
- For out-of-band requests, request **proportionate** proof of identity — do not
  collect more than necessary, and do not force submission of a new Ghana Card
  image solely to verify a request.
- For representatives, obtain proof of authority.
- Record the verification method in the request log (§7).

---

## 5. Timelines & fees

| Item | Position |
| --- | --- |
| Acknowledgement | Promptly on receipt `[TBD]` (e.g. within 5 working days). |
| Response deadline | `[TBD]` — set an internal SLA consistent with current DPC guidance (commonly responses are expected without undue delay; many controllers adopt a 30-day target). Confirm the binding period with the DPC. |
| Extension | For complex/numerous requests, extend with notice to the subject and reason. |
| Fee | Generally free; a reasonable fee may apply only for manifestly unfounded/excessive or repetitive requests `[TBD]`. |

---

## 6. Fulfilment workflow

1. **Log** the request in the register (§7); start the SLA clock.
2. **Acknowledge** to the requester.
3. **Verify identity** (§4).
4. **Locate data** across systems using the RoPA inventory:
   - Postgres (`ApplicantProfile`, `Declaration`, `DeclarationStatusHistory`,
     `Notification*`, `ContactSubmission`, etc.)
   - Object storage (Ghana Card images, receipts, scanned letters)
   - Audit/analytics metadata (note: analytics IPs are pseudonymized/hashed).
   - Decrypt national-ID via `pii-encryption.ts` only for return to the verified
     subject; never expose the HMAC/internal keys.
5. **Assess exemptions/limits** — esp. statutory retention for declarations, and
   third-party data that must be redacted from an access response.
6. **Prepare the response** in a clear, secure format; deliver via a secure
   channel to the verified subject (avoid sending Restricted-PII over insecure
   email — `[TBD]` define the secure delivery method).
7. **Action** rectification/restriction/erasure where granted; record the change
   (and write an audit-log entry).
8. **Close** the request; record outcome and any refusal basis; inform the
   subject of their right to complain to the DPC.

---

## 7. DSAR register (log)

> Maintain even when empty.

| ID | Date received | Requester | Right(s) requested | Identity verified (method) | Acknowledged | Due date | Action taken | Exemptions applied | Date closed | Outcome |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | | | | |

---

## 8. Refusals & exemptions

- Where a request (or part) is refused — e.g. erasure of a declaration under
  statutory retention, or access withheld to protect third-party data —
  **state the reason in writing** and inform the subject of their right to
  complain to the Data Protection Commission.
- Apply exemptions narrowly and document the justification in the register.

---

## 9. Roles & responsibilities

| Role | Responsibility |
| --- | --- |
| DPO / Data Protection Supervisor | Owns the process; decides on rights, exemptions, and refusals; primary contact. |
| Staff / officers | Recognize and forward requests promptly; never ignore an informal request. |
| Engineering/Ops | Assist locating/extracting/deleting data across Postgres, object storage, logs. |
| Approver/owner | Signs off contentious refusals. |

---

## 10. Open items to finalize

1. Publish the **DSAR contact channel** on `/privacy`.
2. Confirm the **binding response deadline** with current DPC guidance.
3. Define the **secure delivery method** for access responses containing PII.
4. Define operational mechanisms for **restriction** and **erasure** (incl. how
   declaration retention overrides erasure).
5. Confirm **portability** and **automated-decision** positions.

---

*Working scaffold, not legal advice. Confirm exact rights, deadlines, fees and
exemptions with the Data Protection Commission and legal counsel.*
