# Multiple Offices per Applicant

## Problem

Applicants may hold more than one public office simultaneously. The current schema stores a single designation, office category, and institution directly on `ApplicantProfile`, limiting each applicant to one office. We need to support multiple offices with temporal tracking (start/end dates).

## Decision

Extract office details from `ApplicantProfile` into a new `ApplicantOffice` model with a one-to-many relationship. Declarations remain tied to the applicant, not individual offices.

## Data Model

### New model: `ApplicantOffice`

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| id | UUID | yes | Primary key |
| profile_id | UUID (FK → ApplicantProfile) | yes | Cascade delete |
| designation | VARCHAR(255) | yes | Job title / position |
| office_category_id | INT (FK → PublicOfficeCategory) | yes | Constitutional category |
| institution_id | UUID (FK → Institution) | no | The institution, if applicable |
| start_date | DATE | yes | When the applicant started this office |
| end_date | DATE | no | When the office ended; null = current/active |
| created_at | TIMESTAMP | yes | Auto |
| updated_at | TIMESTAMP | yes | Auto |

Table name: `applicant_offices`

### Changes to existing models

**`ApplicantProfile`** — remove:
- `designation` column
- `officeCategoryId` / `office_category_id` column
- `institutionId` / `institution_id` column
- Relations to `PublicOfficeCategory` and `Institution`

Add: `offices ApplicantOffice[]` relation.

**`PublicOfficeCategory`** — replace `applicantProfiles` relation with `applicantOffices ApplicantOffice[]`.

**`Institution`** — replace `applicantProfiles` relation with `applicantOffices ApplicantOffice[]`.

### Data migration

Existing `ApplicantProfile` rows that have `designation` and `office_category_id` populated get a corresponding `ApplicantOffice` row created with `start_date` set to the profile's `created_at`. This runs as a SQL data migration within the Prisma migration file.

## API

### New endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/profile/offices` | List all offices for authenticated user |
| POST | `/api/profile/offices` | Add a new office |
| PUT | `/api/profile/offices/[id]` | Update an office |
| DELETE | `/api/profile/offices/[id]` | Remove an office (refuses if it's the last one) |

### Validation (Zod)

```typescript
const officeSchema = z.object({
  designation: z.string().min(2).max(255),
  officeCategoryId: z.number().int().positive(),
  institutionId: z.string().uuid().optional().nullable(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional().nullable(),
}).refine(
  (data) => !data.endDate || !data.startDate || data.endDate > data.startDate,
  { message: "End date must be after start date", path: ["endDate"] }
);
```

### Changes to existing endpoints

- **`POST /api/profile`**: Remove `designation`, `officeCategoryId`, `institutionId` from the request body and validation schema. Profile creation no longer collects office details.
- **`PUT /api/profile`**: Remove office-related fields. Office edits use the new endpoints.
- **`GET /api/profile`** and **`GET /api/auth/me`**: Include `offices` relation (with nested `officeCategory` and `institution`) instead of flat office fields.
- **`pdf.service.ts` (receipt generation)**: List all active offices (where `endDate` is null or `endDate > today`).

### Audit logging

New action types: `OFFICE_ADDED`, `OFFICE_UPDATED`, `OFFICE_REMOVED`. Each office mutation logs the office details as old/new values.

## UI

### Profile setup (`pages/applicant/profile/setup.vue`)

Step 3 becomes a repeatable office entry form. The profile is already created by Step 2 (personal info + Ghana Card upload), so Step 3 calls `POST /api/profile/offices` for each office entry:
- Fields: designation, office category (select), institution (optional select), start date (date picker), end date (optional)
- "Add Office" button submits via API and appends to a visible list
- Added offices can be edited or removed inline (via PUT/DELETE endpoints)
- At least one office required before the user can proceed past Step 3

### Profile edit (`pages/applicant/profile/edit.vue`)

The office section renders a list/table of all offices:
- Columns: designation, category, institution, start date, end date (or "Current")
- Each row has edit and remove actions
- "Add Office" button opens the same form
- Cannot remove the last office

### Admin/officer applicant views

Anywhere an applicant's office details are displayed (admin dashboard, officer review screens), update to show the full list of offices instead of a single entry. Active offices should be visually distinct from ended ones.

## Active office definition

An office is "active" if:
- `endDate` is null, OR
- `endDate` is in the future (> today)

This filter is used on receipts/summaries and should be a shared utility (e.g., a Prisma query helper or a TypeScript predicate).
