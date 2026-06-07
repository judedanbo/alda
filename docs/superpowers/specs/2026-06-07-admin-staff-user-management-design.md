# Admin-managed staff users — Design

**Date:** 2026-06-07
**Status:** Approved (pending spec review)

## Problem

Admins currently have no way to create other system users. Only applicants
exist, and they self-register via `POST /api/auth/register`. We need a way for
an **admin** to create staff users (`admin`, `legal_unit`, `schedule_officer`)
— but **never** an `applicant`. Some staff are also public officials who must
declare their own assets, so the design must let a single person be both staff
and applicant without duplicate accounts.

## Key facts about the existing model (why this needs no schema change)

- **Roles are many-to-many** via the `UserRole` join table — a single `User`
  can hold `legal_unit` *and* `applicant` at once. The "user may also be an
  applicant" requirement is satisfied by one account with two role rows.
- **`applicant` role ≠ `ApplicantProfile`.** Registration grants the role but
  does not create the profile; the profile (with encrypted Ghana Card PII) is
  built later when the person uploads their own ID. So even a staff user who
  holds the `applicant` role cannot file a declaration until **they** complete
  **their own** profile — admins never enter applicant PII.
- **Only `schedule_officer` is office-scoped** via `UserCollectionOffice`.
  `legal_unit` and `admin` are flat, national roles with no office entity.
  "Legal offices" in the original request means **`legal_unit` users**, not a
  new office model.
- **`PasswordResetToken` + `POST /api/auth/reset-password` + the
  `/auth/reset-password` page** already implement tokenized, single-use,
  expiring credential setting. The invite flow reuses them.
- **`login.post.ts`** gates on `isActive` and the bcrypt password compare;
  `emailVerified` only blocks login when `REQUIRE_EMAIL_VERIFICATION_FOR_LOGIN`
  is set. An invited account is therefore safely un-loggable until a password
  is set, because its stored hash is an unusable random value.

**No Prisma schema migration is required.** This feature is new endpoints,
validators, an email template, and admin UI over existing models.

## Decisions (from brainstorming)

1. **"Legal offices" = `legal_unit` users.** No new office entity; no scoping
   for legal users.
2. **Onboarding = email invite / set-password link.** Admin never knows the
   password.
3. **Staff who are also applicants:** admin may **add** the `applicant` role to
   an **existing** user on the edit screen, but can never **create** an
   applicant account. The person always completes their own profile.
4. **Officer scope at creation:** if `schedule_officer` is selected, ≥1
   `CollectionOffice` is **required**. Admin can change/remove offices later.
5. **Email verification:** invited users are created with `emailVerified: false`.
   **Opening the invite link** sets `emailVerified: true` (token proves inbox
   access), then the user lands on the create-password page.

## The applicant rule — enforced in two places, two different rules

| Surface | Rule |
|---|---|
| **Create** `POST /api/admin/users` | Assignable roles are **only** `admin`, `legal_unit`, `schedule_officer`. `applicant` is rejected (400). The create form never offers it. |
| **Edit** `PUT /api/admin/users/[id]/roles` | `applicant` **may** be toggled on for an existing user. Staff roles allowed. Admin cannot strip their own `admin` role (self-lockout guard). |
| **Filing a declaration** | Always requires a self-completed `ApplicantProfile`. Admin never enters PII. (Falls out of the existing role/profile decoupling — no new guard.) |

## Components

### Backend endpoints

#### `POST /api/admin/users` (new)
Create a staff user.
1. Validate body against `adminCreateUserSchema`.
2. Reject if any requested role is `applicant` (defence-in-depth; the schema
   already forbids it).
3. Uniqueness checks for email and phone (reuse the logic in
   `register.post.ts`, including Ghana phone alternates).
4. Resolve role names → role ids.
5. If `schedule_officer` ∈ roles, require a non-empty `collectionOfficeIds`
   and validate the offices exist.
6. Create the `User`:
   - `passwordHash`: bcrypt(cost 13) of a random UUID — **unusable**, forces
     the invite path.
   - `isActive: true`, `emailVerified: false`.
   - `roles`: nested-create `UserRole` rows.
7. Create `UserCollectionOffice` rows for officers.
8. Create `NotificationPreference` defaults.
9. Create a `PasswordResetToken` with a **72h** expiry.
10. `createAuditLog` with `AuditActions.USER_CREATED`.
11. `sendStaffInviteEmail(email, roleLabels, token)`.
12. Return the created user (id, email, phone, roles, offices). **Never** a
    password.

#### `PUT /api/admin/users/[id]/offices` (new)
Replace a user's `UserCollectionOffice` rows. Body: `adminUserOfficesSchema`
(`{ collectionOfficeIds: string[] }`). Transactionally `deleteMany` +
`createMany`. Audit `OFFICE_ASSIGN`. Lets admin change/remove an officer's
scope after creation.

#### `PUT /api/admin/users/[id]/roles` (extend existing)
Keep current behaviour (full replace from `roleIds`) but add a **self-lockout
guard**: an admin cannot remove the `admin` role from their own account
(mirrors the self-deactivation guard in `status.patch.ts`). `applicant`
remains permitted here.

#### `POST /api/auth/accept-invite` (new)
The verify step. Body: `{ token }`.
- Look up the `PasswordResetToken`; 400 if missing / expired / already used.
- Set the owning user's `emailVerified: true`.
- **Do not** consume the token (the password step consumes it).
- Return `{ success: true, email }` so the page can greet the user.

#### `POST /api/auth/reset-password` (reuse, unchanged)
Consumes the token, sets the real `passwordHash`, revokes refresh tokens.
Serves as the password step of the invite flow.

#### `POST /api/admin/users/[id]/resend-invite` (new, v1 nicety)
Delete the user's existing reset tokens, create a fresh 72h
`PasswordResetToken`, resend the invite email. Only meaningful for
not-yet-activated users (no completed password). Audit logged.

### Validators (`server/utils/validators.ts`)

- `adminCreateUserSchema`:
  - `email` (email),
  - `phone?` (existing E.164 regex),
  - `roleNames`: `z.array(z.enum(["admin","legal_unit","schedule_officer"]))`
    `.min(1)` — `applicant` is structurally impossible,
  - `collectionOfficeIds`: `z.array(z.string().uuid())` with a `.refine` /
    `superRefine` making it non-empty **iff** `roleNames` includes
    `schedule_officer`, and required-empty-ignored otherwise.
- `adminUserOfficesSchema`: `{ collectionOfficeIds: z.array(z.string().uuid()) }`.

### Email service (`server/services/email.service.ts`)

- `sendStaffInviteEmail(email, roleLabels, token)`: new template,
  "You've been added to ADLA as <roles>. Set your password to activate your
  account." Link → `${appUrl}/auth/accept-invite?token=${token}`. Same link
  shape as `sendPasswordResetEmail`.

### Audit (`server/utils/audit.ts`)

- Add `AuditActions.USER_CREATED` and `AuditActions.OFFICE_ASSIGN`
  (reuse `ROLE_ASSIGN` for the roles endpoint).

### Frontend

#### `pages/admin/users.vue` (extend)
- **"Create user" button → modal:**
  - email, optional phone,
  - role checkboxes showing **only** `admin`, `legal_unit`, `schedule_officer`,
  - a `CollectionOffice` multi-select that appears and is **required** only when
    `schedule_officer` is checked,
  - submit → `POST /api/admin/users` → toast "Invitation sent".
- **Edit modal:** the existing roles editor gains `applicant` as a toggle with
  a helper note ("they must complete their own Ghana Card profile to declare");
  add an **Offices** section that calls `PUT …/offices`.
- **List:** show an "Invitation pending" badge when `emailVerified` is false
  (i.e. not yet activated). Add a "Resend invite" action for those rows.

#### `pages/auth/accept-invite.vue` (new)
- On mount, read `?token=`, call `POST /api/auth/accept-invite`.
  - On failure (expired/used/invalid): show an error + "request a new invite"
    guidance.
  - On success: show a brief "Email verified — set your password" and render the
    create-password form (the same component/logic as the reset-password page),
    which posts to `POST /api/auth/reset-password`.
- After success, redirect to login.

All client calls use `authFetch`/`$fetch` per existing conventions; admin
endpoints are already gated by the `/api/admin` role-prefix check in
`server/middleware/auth.ts`.

## Data flow (create → activate)

```
Admin → POST /api/admin/users
          ├─ User{emailVerified:false, passwordHash:random-unusable, isActive:true}
          ├─ UserRole rows (staff only)
          ├─ UserCollectionOffice rows (officers)
          ├─ NotificationPreference defaults
          ├─ PasswordResetToken (72h)
          ├─ audit USER_CREATED
          └─ email invite → /auth/accept-invite?token=…

Invitee → opens link → POST /api/auth/accept-invite
          └─ User.emailVerified = true (token NOT consumed)
        → create-password form → POST /api/auth/reset-password
          ├─ User.passwordHash = chosen
          ├─ token.usedAt set
          └─ refresh tokens revoked
        → login normally
```

## Error handling

- Duplicate email/phone → 409 with field errors (reuse register patterns).
- Create with `applicant` role → 400 (schema-level + explicit server guard).
- `schedule_officer` with no offices → 400 from `superRefine`.
- Self-lockout (admin removing own admin role) → 403.
- Accept-invite with bad/expired/used token → 400 with actionable message.
- All admin writes audit-logged; failures in email send are non-blocking
  (logged, mirroring `register.post.ts`).

## Testing

**Unit (vitest):**
- create rejects `applicant` role,
- create requires ≥1 office when `schedule_officer`,
- create stores an unusable password hash + 72h token,
- edit allows adding `applicant`,
- self-lockout guard blocks removing own admin role,
- accept-invite sets `emailVerified` and leaves the token unconsumed,
- accept-invite 400s on expired/used token.

**E2E (playwright):**
- admin creates a `legal_unit` user → invite link → email verified → set
  password → login succeeds,
- admin creates a `schedule_officer` without an office → blocked,
- admin adds `applicant` to an existing staff user → that user can start the
  applicant profile flow.

## Out of scope (YAGNI)

- A separate `LegalOffice` model / legal-unit office scoping.
- Admin-set temporary passwords (invite-only chosen).
- Bulk user import.
- Deleting users (status toggle already exists via `status.patch.ts`).
