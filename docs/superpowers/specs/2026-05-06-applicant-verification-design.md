# Applicant Verification Stage — Design Spec

## Overview

A verification gate between profile completion and declaration creation. After an applicant registers and completes their profile, a legal officer must verify their identity and registration details before the applicant can create declarations. All declaration-creation paths (UI buttons, nav links, API endpoints) are blocked until verification status is `VERIFIED`.

## Trigger

Verification is triggered **automatically** when the applicant completes their profile (`POST /api/profile`). The applicant's `verificationStatus` is set to `PENDING_VERIFICATION` immediately — no manual action required from the applicant.

## Data Model

### New enum: `VerificationStatus`

```
PENDING_VERIFICATION
VERIFIED
ON_HOLD
MORE_INFO_REQUIRED
REJECTED
```

### Changes to `ApplicantProfile`

Add field:

- `verificationStatus VerificationStatus @default(PENDING_VERIFICATION) @map("verification_status")`

Index on `verificationStatus` for efficient queue queries.

### New model: `ApplicantVerificationReview`

```
id                  String   @id @default(uuid()) @db.Uuid
applicantId         String   @map("applicant_id") @db.Uuid  (FK → ApplicantProfile)
reviewerId          String   @map("reviewer_id") @db.Uuid   (FK → User)
status              VerificationStatus                       (the decision)
reason              String   @db.Text                        (required — why this decision)
messageToApplicant  String?  @map("message_to_applicant") @db.Text  (optional — visible to applicant)
createdAt           DateTime @default(now()) @map("created_at")
```

Relations:
- `applicant ApplicantProfile @relation(fields: [applicantId], references: [id])`
- `reviewer User @relation("VerificationReviewedBy", fields: [reviewerId], references: [id])`

Indexes: `applicantId`, `createdAt`.

New relation on `User`: `applicantVerificationReviews ApplicantVerificationReview[] @relation("VerificationReviewedBy")`

New relation on `ApplicantProfile`: `verificationReviews ApplicantVerificationReview[]`

Every review action creates a new row — the full history is preserved. Legal officers can see the chain of decisions on the detail page.

## Re-application After Rejection

When an applicant is rejected or asked for more info:

1. They edit their existing profile (upload clearer images, correct details).
2. They click "Resubmit for Verification" — this calls `POST /api/applicant/verification/resubmit`.
3. Status resets to `PENDING_VERIFICATION`.
4. Legal officers see the updated profile with previous review history (rejection reason, what changed).

Only allowed when current status is `REJECTED` or `MORE_INFO_REQUIRED`.

## Review Model

Self-service queue — all pending verifications appear in a shared list visible to any legal officer. No assignment workflow; any legal officer can review any request.

## API Endpoints

### Legal officer endpoints (`/api/legal/verifications/`)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/legal/verifications` | List verification requests with status filtering, search by name/Ghana Card number, pagination |
| `GET` | `/api/legal/verifications/[id]` | Full applicant details: profile, Ghana Card images, office/institution info, verification history |
| `GET` | `/api/legal/verifications/stats` | Counts by status for dashboard summary cards |
| `POST` | `/api/legal/verifications/[id]/review` | Submit decision — body: `{ status, reason, messageToApplicant? }`. Allowed target statuses: `VERIFIED`, `ON_HOLD`, `MORE_INFO_REQUIRED`, `REJECTED` |

Route protection: `legal_unit` or `admin` role, handled by existing server auth middleware prefix matching on `/api/legal/`.

### Applicant endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/applicant/verification` | Own verification status, latest review reason/message, full review history |
| `POST` | `/api/applicant/verification/resubmit` | Re-trigger verification after rejection or more-info-required. Resets status to `PENDING_VERIFICATION` |

### Changes to existing endpoints

- **`POST /api/declarations`**: Add check — if `profile.verificationStatus !== 'VERIFIED'`, return `403` with message "Your registration must be verified before creating declarations."
- **`POST /api/profile`**: After creating the profile, the `PENDING_VERIFICATION` default applies. Log `APPLICANT_VERIFICATION_REQUESTED` audit action.
- **`GET /api/auth/me`**: Include `verificationStatus` in the response payload so the frontend can gate UI elements.

## Frontend

### New pages

| Page | Purpose |
|------|---------|
| `/legal/verifications` | Queue view — table with status filter tabs (All, Pending, On Hold, More Info Required), search bar, sortable columns (name, date submitted, status) |
| `/legal/verifications/[id]` | Detail view — applicant profile in sections (personal info, Ghana Card images viewable/zoomable, office details, institution). Verification history timeline. Action panel: status buttons + reason/message textareas |

### Changes to existing pages

| Page | Change |
|------|--------|
| Applicant dashboard (`/applicant/dashboard.vue`) | Verification status banner above quick actions. When unverified: show status + reason/message. "New Declaration" button disabled with tooltip. When `MORE_INFO_REQUIRED` or `REJECTED`: show "Edit Profile & Resubmit" button |
| Applicant declarations (`/applicant/declarations`) | "Create Declaration" button disabled with verification gate |
| Dashboard layout nav (`layouts/dashboard.vue`) | "New Declaration" nav link: disabled styling when unverified. Add "Applicant Verifications" nav item for legal officers |
| Legal dashboard (`/legal/dashboard.vue`) | Summary cards: pending/on-hold/more-info counts, linking to queue |

### Auth store changes (`stores/auth.ts`)

- Add `verificationStatus` to user state (populated from `/api/auth/me`).
- Add computed: `isVerified` → `verificationStatus === 'VERIFIED'`.
- Declaration creation gating becomes: `hasProfile && isVerified`.

### Applicant status display

| Status | Color | Message |
|--------|-------|---------|
| `PENDING_VERIFICATION` | Yellow/amber | "Your registration is being reviewed by the legal office" |
| `VERIFIED` | Green | No banner — normal access |
| `ON_HOLD` | Orange | "Your registration is under review. Please wait for further updates" |
| `MORE_INFO_REQUIRED` | Blue | "Action required: The legal office has requested additional information" + specific message |
| `REJECTED` | Red | "Your registration was not approved" + reason + option to edit and resubmit |

## Audit Logging

### New audit actions

| Action | Trigger | Entity |
|--------|---------|--------|
| `APPLICANT_VERIFICATION_REQUESTED` | Profile created or applicant resubmits | ApplicantProfile |
| `APPLICANT_VERIFICATION_REVIEWED` | Legal officer makes any decision | ApplicantProfile |
| `APPLICANT_VERIFICATION_VERIFIED` | Status → VERIFIED | ApplicantProfile |
| `APPLICANT_VERIFICATION_ON_HOLD` | Status → ON_HOLD | ApplicantProfile |
| `APPLICANT_VERIFICATION_MORE_INFO` | Status → MORE_INFO_REQUIRED | ApplicantProfile |
| `APPLICANT_VERIFICATION_REJECTED` | Status → REJECTED | ApplicantProfile |
| `APPLICANT_VERIFICATION_RESUBMITTED` | Applicant resubmits | ApplicantProfile |

Each entry captures `oldValues` (previous status) and `newValues` (new status, reason, reviewer ID).

## Notifications

| Trigger | Recipient | Channels |
|---------|-----------|----------|
| Profile created (verification requested) | Applicant | Email — "Your registration is being reviewed" |
| Status → `VERIFIED` | Applicant | Email + SMS — "You are verified and can create declarations" |
| Status → `ON_HOLD` | Applicant | Email — "Your registration is under investigation" + reason |
| Status → `MORE_INFO_REQUIRED` | Applicant | Email + SMS — "Action required" + legal officer's message |
| Status → `REJECTED` | Applicant | Email — "Registration not approved" + reason + how to resubmit |
| New pending verification | Legal officers | In-app only (dashboard count) |

New `NotificationType` enum values: `VERIFICATION_SUBMITTED`, `VERIFICATION_APPROVED`, `VERIFICATION_REJECTED`, `VERIFICATION_ON_HOLD`, `VERIFICATION_MORE_INFO_REQUIRED`.

Uses existing `notification.service.ts` pattern with a new `notifyVerificationStatusChanged()` helper.
