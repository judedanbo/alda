# API Inventory & Interface Specification — Asset Declaration Portal (ADLA)

> Closes audit-checklist item **D5**. Catalogue of every Nitro server route
> under `app/server/api/`, with method, path, required role/auth, and purpose.
> Authoritative source is the route tree itself; the auth model is in
> `app/server/middleware/auth.ts`. External (machine) interfaces are detailed in
> [`integration-control-documents.md`](./integration-control-documents.md);
> architecture context in [`architecture.md`](./architecture.md).

**Document control:** Version 0.1 (draft) · Owner `[TBD]` (ISO / Engineering
lead) · Reviewed 2026-06-03 · Living reference derived from `app/server/api/**` —
update when routes change.

---

## 1. Authentication & authorization model

- **Transport**: HTTPS. Authenticated calls carry `Authorization: Bearer <JWT>`
  (the client uses `authFetch`, which refreshes on 401).
- **Token**: `{ userId, email, roles[] }`, access TTL 15m / refresh 7d.
- **Enforcement** (`app/server/middleware/auth.ts`): public routes are
  allow-listed; everything else requires a valid Bearer token. Role prefixes:

  | Path prefix | Required role |
  | --- | --- |
  | `/api/admin/**` | `admin` |
  | `/api/officer/**` | `schedule_officer` or `admin` |
  | `/api/legal/**` | `legal_unit` or `admin` |
  | all other non-public | any authenticated user |

- **Officer-office scoping**: write endpoints a `schedule_officer` can hit also
  call `assertOfficerCanActOnOffice` / `assertOfficerCanActOnDeclaration`
  (`officer-scope.ts`) — admins bypass, legal unaffected.
- **Public allow-list**: `/api/auth/*` (except `me`/`logout`), `/api/health`,
  `/api/categories`, `/api/institutions`, `/api/collection-offices`,
  `/api/contact`, `/api/verify/[code]`, and the SMS webhooks (authenticated by
  shared secret, not JWT).
- **Pre-handler controls**: `00.security` (IP rate-limit/abuse/AI policy) and
  `01.security-headers` run before auth; `rate-limit-user` runs after.

Legend — **Auth**: `Public`, `Auth` (any logged-in user), `Officer`
(schedule_officer/admin), `Legal` (legal_unit/admin), `Admin`, `Webhook`
(shared secret), `Dev` (non-production only).

---

## 2. Authentication — `/api/auth/*`

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Public | Create user account |
| POST | `/api/auth/login` | Public | Authenticate; returns access+refresh tokens |
| POST | `/api/auth/refresh` | Public | Exchange refresh token (rotation + replay detection) |
| POST | `/api/auth/logout` | Auth | Invalidate session |
| GET | `/api/auth/me` | Auth | Current user + roles |
| GET | `/api/auth/verify-email` | Public | Email verification via token link |
| POST | `/api/auth/resend-verification` | Auth | Resend verification email |
| POST | `/api/auth/forgot-password` | Public | Request password-reset email |
| POST | `/api/auth/reset-password` | Public | Complete password reset with token |
| GET | `/api/auth/check-phone` | Public | Check if a phone is registered |
| POST | `/api/auth/send-phone-code` | Public | Send phone OTP via SMS |
| POST | `/api/auth/verify-phone` | Public | Verify phone OTP |

## 3. Applicant profile & verification

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/profile` | Auth | Get own applicant profile |
| POST | `/api/profile` | Auth | Create applicant profile |
| PUT | `/api/profile` | Auth | Update profile |
| GET | `/api/profile/check-id` | Auth | Check national-ID uniqueness (via HMAC hash) |
| GET | `/api/applicant/verification` | Auth | Own verification status/history |
| POST | `/api/applicant/verification/resubmit` | Auth | Resubmit verification documents |
| GET | `/api/profile/offices` | Officer | List officer's assigned collection offices |
| POST | `/api/profile/offices` | Officer | Assign officer to an office |
| PUT | `/api/profile/offices/[id]` | Officer | Update office assignment |
| DELETE | `/api/profile/offices/[id]` | Officer | Remove office assignment |

## 4. Declarations — `/api/declarations/*`

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/declarations` | Auth | List own declarations (filter/paginate) |
| POST | `/api/declarations` | Auth | Create declaration (gets unique code) |
| GET | `/api/declarations/stats` | Auth | Own declaration summary stats |
| GET | `/api/declarations/[id]` | Auth | Full declaration by id |
| GET | `/api/declarations/[id]/status` | Auth | Current workflow status |
| POST | `/api/declarations/[id]/reissue-request` | Auth | Submit lost-form reissue request |

## 5. File uploads — `/api/upload/*`

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/upload/ghana-card` | Auth | Upload Ghana Card image (magic-byte validated) |
| POST | `/api/upload/alternate-id` | Auth | Upload alternate ID scan |
| POST | `/api/upload/reissue-letter` | Auth | Upload scanned reissue approval letter |

## 6. Form collection & return — Officer

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/form-collections` | Officer | Record physical form collection (scoped office) |
| GET | `/api/form-collections/pending` | Officer | Declarations awaiting collection |
| POST | `/api/form-returns` | Officer | Record returned (filled) form |
| GET | `/api/form-returns/pending` | Officer | Forms awaiting return |

## 7. Reviews & receipts — Officer

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/reviews` | Officer | List reviews in officer scope |
| POST | `/api/reviews` | Officer | Create review |
| GET | `/api/reviews/pending` | Officer | Declarations awaiting review |
| POST | `/api/reviews/approve` | Officer | Approve declaration |
| POST | `/api/reviews/reject` | Officer | Reject declaration (issues new code) |
| GET | `/api/reviews/[declarationId]/sections` | Officer/Legal | Section reviews for a declaration |
| PATCH | `/api/reviews/sections/[id]/resolve` | Officer | Resolve a flagged section |
| GET | `/api/receipts` | Auth | List receipts (own, or officer-issued) |
| GET | `/api/receipts/pending` | Officer | Declarations ready for receipt |
| POST | `/api/receipts/[declarationId]` | Officer | Generate receipt PDF |
| GET | `/api/officer/stats` | Officer | Officer's personal stats |

## 8. Legal unit — `/api/legal/*`

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/legal/verifications` | Legal | List pending applicant verifications |
| GET | `/api/legal/verifications/[id]` | Legal | Verification details + documents |
| POST | `/api/legal/verifications/[id]/review` | Legal | Approve/reject/hold/request-info |
| GET | `/api/legal/verifications/stats` | Legal | Verification stats |
| GET | `/api/legal/form-reissues` | Legal | List pending reissue requests |
| GET | `/api/legal/form-reissues/[id]` | Legal | Reissue request details |
| POST | `/api/legal/form-reissues/[id]/decision` | Legal | Record reissue decision (reissues form) |
| GET | `/api/legal/form-reissues/stats` | Legal | Reissue stats |
| GET | `/api/legal/code-activity` | Legal | Unique-code generation/usage activity |

## 9. Operational analytics (declaration/compliance) — Officer

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/analytics/declarations/summary` | Officer | Declaration counts by status/office |
| GET | `/api/analytics/declarations/list` | Officer | Filterable declaration list |
| GET | `/api/analytics/declarations/charts` | Officer | Time-series for dashboards |
| GET | `/api/analytics/declarations/export` | Officer | Export filtered declarations (CSV) |
| GET | `/api/analytics/compliance/summary` | Officer | Compliance metrics |
| GET | `/api/analytics/compliance/list` | Officer | Per-office compliance records |

## 10. Admin — `/api/admin/*`

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/admin/users` | Admin | List users (filter by role) |
| PUT | `/api/admin/users/[id]/roles` | Admin | Assign/revoke roles |
| PATCH | `/api/admin/users/[id]/status` | Admin | Activate/deactivate account |
| GET | `/api/admin/roles` | Admin | List roles |
| GET | `/api/admin/declarations` | Admin | Global declaration view |
| GET | `/api/admin/audit-logs` | Admin | Audit trail |
| GET/POST | `/api/admin/categories` | Admin | List / create categories |
| PUT/DELETE | `/api/admin/categories/[id]` | Admin | Update / delete category |
| GET/POST | `/api/admin/institutions` | Admin | List / create institutions |
| PUT | `/api/admin/institutions/[id]` | Admin | Update institution |
| POST | `/api/admin/notifications/test` | Admin | Send test notification |
| GET | `/api/admin/stats` | Admin | System-wide stats |
| GET | `/api/admin/reports` | Admin | Compliance/audit reports |
| GET | `/api/admin/analytics/overview` | Admin | Traffic analytics overview |
| GET | `/api/admin/analytics/realtime` | Admin | Real-time traffic (last hour) |
| GET | `/api/admin/analytics/abuse` | Admin | Detected abuse events |
| GET | `/api/admin/analytics/rate-limit` | Admin | Rate-limit stats |
| GET | `/api/admin/analytics/ai` | Admin | AI-crawler classification stats |
| POST | `/api/admin/analytics/actor-rule` | Admin | Create/update an allow/block rule |

## 11. Notifications & accessibility

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/notifications` | Auth | List own notifications |
| GET | `/api/notifications/stream` | Auth (token) | **SSE** real-time push stream |
| PATCH | `/api/notifications/[id]/read` | Auth | Mark one read |
| POST | `/api/notifications/read-all` | Auth | Mark all read |
| GET | `/api/notifications/preferences` | Auth | Get notification preferences |
| PATCH | `/api/notifications/preferences` | Auth | Update preferences |
| GET | `/api/accessibility/preferences` | Auth | Get accessibility settings |
| PATCH | `/api/accessibility/preferences` | Auth | Update accessibility settings |

## 12. Public & webhooks

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | Public | Liveness/health probe |
| GET | `/api/categories` | Public | Asset/office categories (form dropdowns) |
| GET | `/api/institutions` | Public | Institutions list |
| GET | `/api/collection-offices` | Public | Collection-office locations |
| POST | `/api/contact` | Public | Submit contact/feedback form |
| GET | `/api/verify/[code]` | Public | Verify a unique declaration code |
| POST | `/api/webhooks/sms/hubtel` | Webhook | Hubtel SMS delivery callback |
| POST | `/api/webhooks/sms/arkesel` | Webhook | Arkesel SMS delivery callback |

## 13. Development-only — `/api/dev/*`

> Registered only when `NODE_ENV !== "production"`. Must not be reachable in prod.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/dev/users` | Dev | List test users |
| POST | `/api/dev/switch-user` | Dev | Switch authenticated user (local testing) |

---

## 14. Conventions

- **Request validation**: bodies are parsed with Zod via `validateBody`
  (schemas centralized in `app/server/utils/validators.ts`); failures return
  400 with `error.flatten()`.
- **Audit**: state-changing endpoints write an `AuditLog` via `createAuditLog`.
- **Errors**: 401 (no/invalid token), 403 (role/scope denied), 429 (rate
  limited), 400 (validation).
- **Pagination/filtering**: list endpoints accept query params (page/size,
  status filters); see handler source for specifics.

*Catalogue derived from `app/server/api/**` (98 route files). Keep this in sync
when adding or changing routes.*
