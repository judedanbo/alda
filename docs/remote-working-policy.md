# Remote Working Policy — Asset Declaration Portal (ADLA)

> **Scaffold / working draft.** Security requirements when staff/officers access
> ADLA or its data away from controlled offices. Closes SoA control **6.7**;
> supports **8.1 (endpoints)**, **7.9 (off-premises assets)**. Derives from
> `docs/information-security-policy.md`.

---

## 0. Document control

| Field | Value |
| --- | --- |
| Version | 0.1 (draft) |
| Owner | `[TBD]` (Information Security Officer) |
| Approved by | `[TBD]` |
| Date created | 2026-06-03 |
| Review | Annually / on change. |

---

## 1. Purpose & scope

Define how ADLA and its data may be accessed securely outside controlled
premises (home, field offices, travel). Applies to all staff/officers/contractors
granted remote access. **`[TBD]`: confirm whether remote access is permitted at
all, and for which roles** — if not permitted, this policy states that
restriction.

## 2. Eligibility & authorization

- Remote access is granted only to authorized roles `[TBD]` and only via approved
  methods.
- Privileged/admin and bulk-PII operations may be **restricted to office/managed
  environments** `[TBD]`.

## 3. Device requirements

- Use **authorized, managed devices** where possible; keep OS/software patched
  and malware-protected; full-disk encryption enabled.
- Personal/unmanaged devices `[TBD]` — prohibited or restricted (no local storage
  of Restricted-PII).
- Screen lock with short timeout; up-to-date browser.

## 4. Network & connection

- Access ADLA only over **HTTPS**; avoid untrusted public Wi-Fi for PII work, or
  use a `[TBD]` VPN/secure tunnel.
- Do not expose ADLA admin/infrastructure interfaces to untrusted networks.

## 5. Data handling off-premises

- Treat Restricted-PII per the **data-classification policy**: no downloads to
  local/personal storage, no screenshots, no printing without authorization.
- Apply **clear-screen** in shared/public spaces; shield screens showing PII.
- Physical declaration forms must not be removed from authorized offices `[TBD]`.

## 6. Authentication

- Strong authentication required; **MFA strongly recommended for remote and
  privileged access** `[TBD]`.
- Report lost/stolen devices or suspected compromise immediately (IRP §5.2) so
  sessions/tokens can be revoked.

## 7. Open items

1. Decide **whether/for whom** remote access is allowed, and any office-only
   operations.
2. Specify **managed vs personal device** rules and any VPN requirement.
3. Confirm **MFA** for remote/privileged access.

---

*Working scaffold, not legal advice.*
