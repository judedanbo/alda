# Declaration Compliance Monitoring

**Date**: 2026-05-22
**Status**: Draft

## Problem

Ghana's Article 286(5) requires public office holders to declare assets at specific points in their tenure. The system currently tracks declarations and office history but has no way to detect non-compliance — applicants who have missed or are about to miss a declaration obligation.

## Compliance Rules

For each `ApplicantOffice` record, the system generates a series of **declaration obligations** with due dates:

1. **Assumption of office** — due date = `ApplicantOffice.startDate`
2. **Periodic (every 4 years)** — due dates = `startDate + 4y`, `startDate + 8y`, etc., up to `endDate` or today (whichever is earlier) for active offices
3. **Departure from office** — due date = `ApplicantOffice.endDate` (only if set)

### Obligation Satisfaction

An obligation is satisfied if a `Declaration` with status `SEALED` exists for that applicant where the sealed date falls within **90 days before or after** the due date.

The sealed date is determined from `DeclarationStatusHistory` where `status = 'SEALED'`.

### Compliance Status Classification

For each unsatisfied obligation:

| Status       | Condition                                      | Color  |
|-------------|------------------------------------------------|--------|
| **Upcoming** | Due date is within the next 90 days            | Blue   |
| **Due Now**  | Due date has passed, within 90 days overdue    | Amber  |
| **Overdue**  | Due date passed more than 90 days ago          | Red    |

Satisfied obligations are classified as **Compliant** (Green).

### Role Scoping

- **Admin** — sees all applicants across all institutions
- **Schedule Officer** — sees applicants whose declarations they have processed (via `DeclarationStatusHistory.changedById`)
- **Legal Unit** — sees all applicants (compliance oversight)

## Architecture

### Approach: Hybrid (real-time query + cache)

Compliance status is computed on-demand via Prisma queries, then cached using the existing `analytics-cache.ts` utility with a 300-second TTL. No schema changes required.

The cache key includes the current date (day granularity) so urgency tier transitions are reflected daily even if the cache is warm.

### Computation Flow

1. Fetch all `ApplicantOffice` records (with profile, institution, declarations)
2. For each office, generate the list of due dates (assumption + periodic + departure)
3. For each due date, check if a SEALED declaration exists within the +-90 day window
4. Classify each unmet obligation as upcoming/due_now/overdue based on today's date
5. Aggregate into summary KPIs and return paginated list

## API Design

### `GET /api/analytics/compliance/summary`

Returns KPI counts for dashboard cards.

**Response:**
```json
{
  "totalApplicantsWithOffices": 150,
  "compliant": 120,
  "upcoming": 10,
  "dueNow": 12,
  "overdue": 8,
  "complianceRate": 80.0
}
```

**Auth**: Requires `admin`, `schedule_officer`, or `legal_unit` role.

### `GET /api/analytics/compliance/list`

Returns paginated list of compliance obligations.

**Query Parameters:**
- `status` — filter by `upcoming`, `due_now`, `overdue`, `compliant` (optional, default: all non-compliant)
- `institutionId` — filter by institution UUID (optional)
- `search` — search by applicant name or Ghana card number (optional)
- `page` — page number (default: 1)
- `pageSize` — items per page (default: 25, max: 100)
- `sortBy` — `dueDate`, `applicantName`, `institution`, `daysPastDue` (default: `dueDate`)
- `sortOrder` — `asc` or `desc` (default: `asc`)

**Response:**
```json
{
  "items": [
    {
      "applicantId": "uuid",
      "fullName": "John Doe",
      "ghanaCardNumber": "GHA-XXXX-XXXX",
      "institution": "Ministry of Finance",
      "designation": "Director",
      "obligationType": "periodic",
      "dueDate": "2026-03-15",
      "daysPastDue": 68,
      "status": "due_now",
      "lastDeclarationDate": "2022-03-10",
      "officeStartDate": "2022-03-15",
      "officeEndDate": null
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 25,
    "total": 42,
    "totalPages": 2
  }
}
```

**Auth**: Same role restrictions as summary.

## Frontend Design

### Dashboard Integration

On each role's dashboard page (`/admin/dashboard`, `/officer/dashboard`, `/legal/dashboard`), add a "Declaration Compliance" section with 4 KPI cards:

1. **Overdue** (red badge) — count of obligations >90 days past due
2. **Due Now** (amber badge) — count within 0-90 days past due
3. **Upcoming** (blue badge) — count due in next 90 days
4. **Compliance Rate** (green badge) — percentage

Each card links to the dedicated compliance page (`/{role}/compliance`).

### Dedicated Compliance Pages

New pages: `/admin/compliance`, `/officer/compliance`, `/legal/compliance`

Layout:
1. **KPI cards row** — same 4 metrics, larger display
2. **Filter bar** — status dropdown, institution dropdown, text search
3. **Data table** — columns:
   - Applicant Name
   - Ghana Card Number
   - Institution
   - Designation
   - Obligation Type (Assumption / Periodic / Departure)
   - Due Date
   - Status (colored badge)
   - Days Past Due (or "in X days" for upcoming)
   - Last Declaration Date

Uses existing `DataTable.vue` component. Status badges use existing `TONE_BADGE` utility.

### New Components

In `app/components/compliance/`:
- `ComplianceKpiCards.vue` — 4-card grid with counts and links
- `ComplianceFilterBar.vue` — status, institution, search filters
- `ComplianceTable.vue` — paginated data table

### New Composable

`app/composables/useCompliance.ts` — manages:
- Summary data fetching (for KPI cards)
- List data fetching with filters and pagination
- Filter state (reactive)
- Follows the same pattern as existing `useAnalytics.ts`

## Files to Create/Modify

### New Files
- `app/server/api/analytics/compliance/summary.get.ts`
- `app/server/api/analytics/compliance/list.get.ts`
- `app/server/utils/compliance.ts` (core obligation computation logic)
- `app/composables/useCompliance.ts`
- `app/components/compliance/ComplianceKpiCards.vue`
- `app/components/compliance/ComplianceFilterBar.vue`
- `app/components/compliance/ComplianceTable.vue`
- `app/pages/admin/compliance.vue`
- `app/pages/officer/compliance.vue`
- `app/pages/legal/compliance.vue`

### Modified Files
- `app/pages/admin/dashboard.vue` — add compliance KPI section
- `app/pages/officer/dashboard.vue` — add compliance KPI section
- `app/pages/legal/dashboard.vue` — add compliance KPI section
- Dashboard nav (sidebar) — add compliance link for each role

## Out of Scope

- Email/SMS notifications for upcoming obligations (future enhancement)
- Applicant self-service compliance view (they see their own declarations already)
- Compliance history/trending over time
- Export of compliance data (can be added later following the analytics export pattern)
