# ADLA Demo-Ready Design Spec

**Date:** 2026-05-06
**Goal:** Get the Asset Declaration app to a testable, demo-ready state by fixing broken flows, establishing a component system, and filling missing pages.

---

## Scope

### In Scope

1. Fix broken flows (emails, verification, password reset, notifications)
2. Install shadcn-vue component foundation + shared composables
3. Refactor all 27 pages onto the component system
4. Build missing pages (reset-password, verify-email, settings, admin categories, profile edit)

### Deferred

See `docs/backlog.md` for Tier 2/3 items (testing, security hardening, Kubernetes, accessibility, admin delete operations, audit consistency).

---

## Phase A: Fix Broken Flows

### A1. Wire Email Sending

**Files to modify:**

- `server/api/auth/register.post.ts` — after user creation, call:
  - `emailService.sendWelcomeEmail(user.email, user.fullName)`
  - `emailService.sendVerificationEmail(user.email, verificationToken)`
- `server/api/auth/forgot-password.post.ts` — after token generation, call:
  - `emailService.sendPasswordResetEmail(user.email, resetToken)`
- `server/api/contact.post.ts` — after saving contact submission, call:
  - `emailService.sendContactAcknowledgment(email, name, category)` (new template: "We received your inquiry and will respond within 2 business days")

**Constraint:** Email calls must be non-blocking — wrap in try/catch so a mail delivery failure doesn't fail the API response.

### A2. Email Verification Flow

**New Prisma model:**

```prisma
model EmailVerificationToken {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  token     String   @unique
  expiresAt DateTime @map("expires_at")
  usedAt    DateTime? @map("used_at")
  createdAt DateTime @default(now()) @map("created_at")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([token])
  @@index([userId])
  @@map("email_verification_tokens")
}
```

**Also add to the `User` model:** `emailVerificationTokens EmailVerificationToken[]` relation field.

**Token lifetime:** 24 hours.

**New endpoint:** `server/api/auth/verify-email.get.ts`
- Accepts `?token=<token>` query parameter
- Validates token exists, not expired, not used
- Sets `user.emailVerified = true`, marks token as used
- Returns success response

**New page:** `pages/auth/verify-email.vue`
- Reads token from URL query on mount
- Calls the verify endpoint
- Shows success state with link to login, or error state with "request new verification" link

**Modify `register.post.ts`:**
- Generate an `EmailVerificationToken` after user creation
- Pass token to email service

**Modify `login.post.ts`:**
- After successful login, include `emailVerified: boolean` in the response payload
- Do NOT block login (soft warning approach for demo)

**Modify auth store (`stores/auth.ts`):**
- Store `emailVerified` flag from login response
- Expose `isEmailVerified` computed

**Dashboard banner:**
- Show a dismissible warning banner on applicant dashboard when `!isEmailVerified`
- Banner includes "Resend verification email" action

**New endpoint:** `server/api/auth/resend-verification.post.ts`
- Requires authentication
- Generates new token, invalidates old ones, sends email
- Rate limit: one resend per 2 minutes (simple timestamp check, not full rate limiting middleware)

### A3. Password Reset Page

**New page:** `pages/auth/reset-password.vue`
- Reads `token` from URL query parameter (`/auth/reset-password?token=xxx`)
- Form fields: new password, confirm password
- Password strength validation (matching register page rules)
- Calls `POST /api/auth/reset-password` with `{ token, password }`
- Success state: "Password reset successfully" with link to login
- Error states: invalid token, expired token, password mismatch

**Modify `pages/auth/forgot-password.vue`:**
- Success message should mention "check your email" (currently shows success but email isn't sent)

### A4. Wire Notification Service

**Files to modify (one notification call each):**

| File | Notification Helper |
|------|-------------------|
| `server/api/declarations/index.post.ts` | `notifyUniqueCodeGenerated(declaration, applicant)` |
| `server/api/submissions/index.post.ts` | `notifySubmissionRecorded(declaration, applicant)` |
| `server/api/reviews/index.post.ts` | `notifyDeclarationApproved(declaration, applicant)` or `notifyDeclarationRejected(declaration, applicant, reason)` |
| `server/api/receipts/[declarationId].post.ts` | `notifyReceiptReady(declaration, applicant, receiptUrl)` |
| `server/api/pickup/[declarationId].post.ts` | `notifyPickupScheduled(declaration, applicant, pickupDate)` |

**Pattern for each:** After the successful Prisma mutation and audit log, add:
```typescript
try {
  await notifyXxx(...)
} catch (e) {
  console.error('Notification failed:', e)
}
```

Non-blocking — notification failure must not roll back the state change.

---

## Phase B: Component Foundation

### B1. shadcn-vue Components to Install

```bash
npx shadcn-vue@latest add button input label card table dialog badge \
  select textarea dropdown-menu alert separator tabs pagination tooltip switch skeleton
```

### B2. Composables

**`composables/useApiFetch.ts`**
- Wraps `$fetch` with auth headers from auth store
- Normalizes errors into `{ message: string, statusCode: number, fieldErrors?: Record<string, string> }`
- On 401: attempts token refresh via auth store, retries original request once
- Returns `{ data, error, pending, execute }` (reactive refs)
- Supports generic typing: `useApiFetch<Declaration[]>('/api/declarations')`

**`composables/useAuth.ts`**
- Thin wrapper over `useAuthStore()`
- Exposes: `user`, `isAuthenticated`, `isEmailVerified`, `isApplicant`, `isOfficer`, `isLegalUnit`, `isAdmin`
- Exposes: `login()`, `logout()`, `register()`
- Handles redirect-after-login logic

**`composables/useDeclarations.ts`**
- `fetchDeclarations(filters?)` — list with pagination
- `fetchDeclaration(id)` — single declaration with timeline
- `createDeclaration()` — create and return unique code
- `submitDeclaration(id)` — submit for review

**`composables/useNotifications.ts`**
- Wraps notification store
- `notifications`, `unreadCount`, `hasUnread` (reactive)
- `markAsRead(id)`, `markAllAsRead()`, `refresh()`

### B3. App-Level Components

**`components/app/StatusBadge.vue`**
- Props: `status: DeclarationStatus`
- Maps status to shadcn Badge variant + color:
  - PENDING → outline/yellow
  - SUBMITTED → default/blue
  - UNDER_REVIEW → secondary/purple
  - APPROVED → default/green
  - REJECTED → destructive/red
  - SEALED → default/emerald
  - COMPLETED → default/gray

**`components/app/ConfirmDialog.vue`**
- Props: `open`, `title`, `description`, `confirmLabel`, `variant` (default/destructive)
- Emits: `confirm`, `cancel`
- Uses shadcn Dialog + Button

**`components/app/NotificationBell.vue`**
- Uses notification composable for `unreadCount`
- Renders bell icon with numeric badge (shadcn Badge) when count > 0
- Links to `/notifications`

**`components/app/DataTable.vue`**
- Props: `columns`, `data`, `loading`, `emptyMessage`, `emptyIcon`
- Slots: `#cell(columnKey)` for custom cell rendering
- Built-in: loading skeleton rows, empty state with icon + message
- Uses shadcn Table

**`components/app/PageHeader.vue`**
- Props: `title`, `description`
- Slot: `#actions` for page-level action buttons

---

## Phase C: Refactor Pages onto Components

### Approach

For each page group, replace raw HTML with shadcn components and composables:

- Replace `<input class="...">` → `<Input>`
- Replace `<button class="...">` → `<Button>`
- Replace hand-built tables → `<DataTable>`
- Replace inline modals → `<Dialog>` / `<ConfirmDialog>`
- Replace status spans → `<StatusBadge>`
- Replace `$fetch` with manual headers → `useApiFetch` composable
- Replace direct store imports → composables

### Page Groups

**Auth pages (3):** login, register, forgot-password
**Applicant pages (5):** dashboard, declarations, declaration/new, declaration/[id], profile/setup
**Officer pages (5):** dashboard, submissions, reviews, receipts, pickups
**Legal pages (2):** dashboard, verify
**Admin pages (6):** dashboard, declarations, users, institutions, audit-logs, reports
**Public + general (5):** index, contact, privacy, terms, notifications
**Layout:** dashboard.vue — integrate NotificationBell, build DropdownMenu for profile

### Key UX Additions During Refactor

- **Confirmation dialogs:** reject declaration, deactivate user, logout, role change
- **Notification badge:** real unread count in dashboard header
- **Profile dropdown:** actual DropdownMenu with profile info, settings link, logout
- **Loading skeletons:** replace spinners with skeleton rows in tables
- **Search result counts:** "Showing X of Y results" on filtered lists

---

## Phase D: Missing Pages

### D1. Settings/Preferences Page

**Page:** `pages/settings/preferences.vue`
- Layout: dashboard
- Fetches current preferences via `GET /api/notifications/preferences`
- Toggle switches for: email notifications, SMS notifications, in-app notifications
- Save via `PATCH /api/notifications/preferences`
- Uses shadcn Card, Switch (install), Label

**Add to dashboard layout navigation** for all roles.

### D2. Admin Categories CRUD

**New endpoints:**
- `server/api/admin/categories/index.get.ts` — list all categories (including inactive, for admin)
- `server/api/admin/categories/index.post.ts` — create category
- `server/api/admin/categories/[id].put.ts` — update category
- `server/api/admin/categories/[id].delete.ts` — soft-delete (set `isActive = false`)

**New page:** `pages/admin/categories.vue`
- DataTable with columns: name, article reference, description, status (active/inactive), actions
- Create/edit dialog with form: name, description, article reference
- Soft-delete with confirmation dialog
- Reactivate button for inactive categories

**Modify public `GET /api/categories`:** Already filters active-only, no change needed.

### D3. Profile Edit Page

**New endpoint:** `server/api/profile/index.put.ts`
- Requires authentication + applicant role
- Validates with updated profile schema (same as create but all fields optional)
- Updates existing ApplicantProfile
- Allows Ghana Card image re-upload (keeps old images if not provided)
- Audit logs the change

**New page:** `pages/applicant/profile/edit.vue`
- Single-page form (not wizard) pre-filled with current profile data
- Ghana Card images shown as thumbnails with "Change" option
- Office details (institution, designation, category) editable
- Full name and Ghana Card number read-only (require admin intervention to change for compliance)

**Add navigation link** from applicant dashboard and profile section.

---

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Email verification token | New `EmailVerificationToken` model | Separate from password reset — different expiry (24h vs 1h), different semantics |
| Unverified login | Soft warning (banner) | Hard block risks locking out demo users; flip to hard block for production |
| Category delete | Soft delete (`isActive = false`) | FK constraint — existing profiles reference categories |
| Profile edit restrictions | Full name + Ghana Card number read-only | Compliance: legal identity fields require admin-level change |
| Notification wiring | Non-blocking try/catch | Notification failure must not roll back state transitions |
| `useApiFetch` | Wraps `$fetch` with auto-auth + 401 retry | Eliminates duplicated header/error logic across all 27 pages |
