# Access Control Policy — Asset Declaration Portal (ADLA)

> **Scaffold / working draft.** Defines how access to ADLA and its data is
> granted, enforced, reviewed, and revoked. Documents in policy form the access
> model **already implemented in code**. Aligned to **ISO/IEC 27001:2022 A.5.15-18,
> A.8.2-5** and **Act 843**. `[TBD]` items need owner confirmation.
>
> Derives from `docs/information-security-policy.md`. See also `CLAUDE.md`
> (auth architecture), `docs/security-assessment.md`, `docs/ropa.md` (TOMs T3/T4).

---

## 0. Document control

| Field | Value |
| --- | --- |
| Version | 0.1 (draft) |
| Owner | `[TBD]` (Information Security Officer) |
| Approved by | `[TBD]` |
| Date created | 2026-06-03 |
| Review cadence | Annually and on role/architecture change. |

---

## 1. Purpose & scope

Ensure only authorized, authenticated identities access ADLA, each limited to
the minimum needed for their role (least privilege). Scope: all ADLA users
(applicants, staff), all API endpoints and pages, all data stores, and
administrative/infrastructure access.

## 2. Principles

- **Least privilege** — grant the minimum access required.
- **Role-based access control (RBAC)** — access via defined roles, not ad-hoc grants.
- **Need-to-know** — Restricted-PII access limited to those who require it.
- **Segregation of duties** — the workflow separates Applicant / Schedule Officer / Legal Unit / Admin so no one actor controls an end-to-end declaration unchecked.
- **Default deny** — access is denied unless explicitly granted.

## 3. Roles & the access model (as implemented)

ADLA roles are **exactly**: `applicant`, `schedule_officer`, `legal_unit`,
`admin` (see `CLAUDE.md`). Enforcement is in two aligned places:

- **Server** — `app/server/middleware/auth.ts`: allow-lists public routes,
  requires a Bearer JWT otherwise, sets `event.context.auth`, and enforces role
  prefixes: `/api/admin` → `admin`; `/api/officer` → `schedule_officer|admin`;
  `/api/legal` → `legal_unit|admin`.
- **Client** — `app/middleware/auth.ts`: gates `/admin`, `/officer`, `/legal`
  page trees via the Pinia `auth` store.

> **Rule:** any new role check must be added to **both** middleware files
> together.

### 3.1 Role → access matrix

| Capability | applicant | schedule_officer | legal_unit | admin |
| --- | --- | --- | --- | --- |
| Register, manage own profile, upload Ghana Card | ✅ (self) | — | — | ✅ |
| Initiate declaration (`CODE_GENERATED`) | ✅ | — | — | ✅ |
| Form collection / return / submission / review / receipt | — | ✅ (scoped office) | — | ✅ |
| Lost-form reissue decision | — | — | ✅ | ✅ |
| Authenticity verification (unique code) | — | — | ✅ | ✅ |
| Audit logs, reports, user/institution management | — | — | — | ✅ |

### 3.2 Officer-to-office scoping

`schedule_officer` users are scoped to specific `CollectionOffice`(s) via the
`UserCollectionOffice` junction. Every write endpoint a schedule officer can hit
calls `assertOfficerCanActOnOffice` or `assertOfficerCanActOnDeclaration`
(`server/utils/officer-scope.ts`). **Admins bypass; legal_unit is unaffected.**
New officer-accessible write endpoints **must** enforce scoping.

## 4. Authentication requirements

| Control | Position |
| --- | --- |
| Credential storage | bcrypt password hashing; constant-time user-not-found path. |
| Brute-force protection | Per-account lockout (10 failures / 15 min → 60-min lock) — `auth-lockout.ts`. |
| Tokens | JWT access (15m) + refresh (7d), signed with separate secrets; refresh-token rotation with family + replay detection. |
| Token storage / cookies | `HttpOnly` / `Secure` cookie flags `[TBD]` — confirm remediation of the cookie-flag finding. |
| Email verification | `REQUIRE_EMAIL_VERIFICATION_FOR_LOGIN` — enable in production once delivery is reliable. |
| Multi-factor authentication | `[TBD]` — recommended for `admin`/`legal_unit` privileged accounts; document the decision. |
| Password policy | `[TBD]` — define minimum length/complexity. |

## 5. Access lifecycle (provisioning → review → de-provisioning)

| Stage | Requirement |
| --- | --- |
| Request & approval | Staff access requested and approved by `[TBD]` (line manager + ISO); role and (for officers) office scope specified. |
| Provisioning | Grant the approved role(s)/office(s) only; record in the access register `[TBD]`. |
| Joiner/Mover/Leaver | On role change, adjust access promptly; on exit, **disable access same day** and revoke tokens. |
| Periodic review | Recertify all staff/admin access at least `[TBD]` (e.g. quarterly); record evidence. |
| Privileged accounts | `admin` accounts inventoried, justified, and reviewed more frequently; avoid shared accounts. |

## 6. Privileged & administrative access

- `admin` has access to everything incl. audit logs and user/institution
  management — grant sparingly and review often.
- Infrastructure access (DB, object store, secret store, hosting) is restricted
  to named DevOps personnel, least-privilege, and logged.
- No shared/generic privileged credentials; individual accountability required.

## 7. Monitoring & enforcement

- Authentication and authorization events are audit-logged; anomalies
  (`REFRESH_TOKEN_REPLAY_DETECTED`, lockout spikes) feed the IR process.
- Rate limiting (IP, route-group, per-user) and security middleware run ahead of
  handlers (`00.security.ts` → `auth.ts` → `rate-limit-user.ts`).
- Access violations are investigated per the incident-response plan.

## 8. Open items to finalize

1. Confirm **cookie flags** (`HttpOnly`/`Secure`) and **MFA** decision for privileged roles.
2. Define the **password policy**.
3. Stand up the **access request/approval workflow** and **access register**.
4. Set the **access-review cadence** and capture recertification evidence.
5. Formalize **JML** (joiner/mover/leaver) steps with HR.

---

*Working scaffold, not legal advice. Adopt and have management approve before
relying on it for audit.*
