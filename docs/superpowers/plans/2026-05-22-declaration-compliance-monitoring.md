# Declaration Compliance Monitoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect public office holders who have missed, are approaching, or are overdue on Article 286(5) asset declaration obligations, and surface this on admin/officer/legal dashboards with a dedicated compliance page.

**Architecture:** A server-side compliance computation utility generates obligation due dates from `ApplicantOffice` records (assumption, periodic 4-year, departure), checks each against SEALED `Declaration` records within a ±90-day window, and classifies results as compliant/upcoming/due_now/overdue. Two API endpoints (summary + list) serve the data with Redis caching (300s TTL). The frontend adds KPI cards to each role's dashboard linking to a new compliance page with filters and a data table.

**Tech Stack:** Nuxt 4, Prisma (PostgreSQL), Redis (analytics cache), Vue 3 Composition API, shadcn-vue, Tailwind v4, TypeScript strict mode

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `app/server/utils/compliance.ts` | Core compliance logic: generate obligations from office records, check against sealed declarations, classify status |
| `app/server/api/analytics/compliance/summary.get.ts` | Summary endpoint returning KPI counts (overdue, due_now, upcoming, compliant, rate) |
| `app/server/api/analytics/compliance/list.get.ts` | Paginated list endpoint with filters (status, institution, search, sort) |
| `app/composables/useCompliance.ts` | Client composable: fetches summary + list, manages filter/pagination state |
| `app/components/compliance/ComplianceKpiCards.vue` | 4-card grid: Overdue (red), Due Now (amber), Upcoming (blue), Compliance Rate (green) |
| `app/components/compliance/ComplianceFilterBar.vue` | Filters: status dropdown, institution dropdown, search input, reset button |
| `app/components/compliance/ComplianceTable.vue` | Paginated data table with sortable columns and status badges |
| `app/pages/admin/compliance.vue` | Admin compliance page using above components |
| `app/pages/officer/compliance.vue` | Officer compliance page (same structure, role-scoped data) |
| `app/pages/legal/compliance.vue` | Legal unit compliance page (same structure, full access) |

### Modified Files

| File | Change |
|------|--------|
| `app/pages/admin/dashboard.vue` | Add compliance KPI section with link to `/admin/compliance` |
| `app/pages/officer/dashboard.vue` | Add compliance KPI section with link to `/officer/compliance` |
| `app/pages/legal/dashboard.vue` | Add compliance KPI section with link to `/legal/compliance` |
| `app/layouts/dashboard.vue` | Add "Compliance" nav item for admin, officer, legal roles |

---

## Task 1: Core Compliance Computation Utility

**Files:**
- Create: `app/server/utils/compliance.ts`

This is the heart of the feature. It generates obligation due dates from `ApplicantOffice` records and checks them against sealed declarations.

- [ ] **Step 1: Create `app/server/utils/compliance.ts` with types and obligation generator**

```typescript
// app/server/utils/compliance.ts
import prisma from "~/server/utils/prisma";
import { getCached, buildCacheKey } from "~/server/utils/analytics-cache";

export type ObligationType = "assumption" | "periodic" | "departure";
export type ComplianceStatus = "compliant" | "upcoming" | "due_now" | "overdue";

export interface ComplianceObligation {
  applicantId: string;
  fullName: string | null;
  ghanaCardNumber: string | null;
  institution: string | null;
  institutionId: string | null;
  designation: string;
  obligationType: ObligationType;
  dueDate: Date;
  daysPastDue: number;
  status: ComplianceStatus;
  lastDeclarationDate: string | null;
  officeStartDate: string;
  officeEndDate: string | null;
}

export interface ComplianceSummary {
  totalApplicantsWithOffices: number;
  compliant: number;
  upcoming: number;
  dueNow: number;
  overdue: number;
  complianceRate: number;
}

export interface ComplianceListResult {
  items: ComplianceObligation[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface ComplianceFilters {
  status?: ComplianceStatus;
  institutionId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

const OBLIGATION_INTERVAL_YEARS = 4;
const TOLERANCE_DAYS = 90;

function generateDueDates(startDate: Date, endDate: Date | null, today: Date): { date: Date; type: ObligationType }[] {
  const dues: { date: Date; type: ObligationType }[] = [];

  dues.push({ date: new Date(startDate), type: "assumption" });

  const boundary = endDate ?? today;
  let nextPeriodic = new Date(startDate);
  nextPeriodic.setFullYear(nextPeriodic.getFullYear() + OBLIGATION_INTERVAL_YEARS);

  while (nextPeriodic <= boundary) {
    dues.push({ date: new Date(nextPeriodic), type: "periodic" });
    nextPeriodic = new Date(nextPeriodic);
    nextPeriodic.setFullYear(nextPeriodic.getFullYear() + OBLIGATION_INTERVAL_YEARS);
  }

  // Also include the next upcoming periodic if still active and it's within the future tolerance window
  if (!endDate && nextPeriodic.getTime() - today.getTime() <= TOLERANCE_DAYS * 86400000) {
    dues.push({ date: new Date(nextPeriodic), type: "periodic" });
  }

  if (endDate) {
    dues.push({ date: new Date(endDate), type: "departure" });
  }

  return dues;
}

function classifyObligation(dueDate: Date, today: Date): ComplianceStatus {
  const diffMs = today.getTime() - dueDate.getTime();
  const diffDays = diffMs / 86400000;

  if (diffDays < -TOLERANCE_DAYS) {
    // More than 90 days in the future — not yet relevant (shouldn't appear)
    return "compliant";
  }
  if (diffDays < 0) {
    return "upcoming";
  }
  if (diffDays <= TOLERANCE_DAYS) {
    return "due_now";
  }
  return "overdue";
}

function isSatisfied(dueDate: Date, sealedDates: Date[]): boolean {
  const toleranceMs = TOLERANCE_DAYS * 86400000;
  return sealedDates.some(
    (sd) => Math.abs(sd.getTime() - dueDate.getTime()) <= toleranceMs,
  );
}

export async function computeComplianceObligations(
  scopeUserId?: string,
): Promise<ComplianceObligation[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Build scope filter for schedule_officer: only applicants they've processed
  let applicantIdFilter: string[] | undefined;
  if (scopeUserId) {
    const processed = await prisma.declarationStatusHistory.findMany({
      where: { changedById: scopeUserId },
      select: { declaration: { select: { applicantId: true } } },
      distinct: ["declarationId"],
    });
    applicantIdFilter = [...new Set(processed.map((p) => p.declaration.applicantId))];
    if (applicantIdFilter.length === 0) return [];
  }

  const offices = await prisma.applicantOffice.findMany({
    where: applicantIdFilter
      ? { profile: { id: { in: applicantIdFilter } } }
      : undefined,
    select: {
      designation: true,
      startDate: true,
      endDate: true,
      institution: { select: { id: true, name: true } },
      profile: {
        select: {
          id: true,
          fullName: true,
          ghanaCardNumber: true,
          declarations: {
            select: {
              statusHistory: {
                where: { status: "SEALED" },
                select: { createdAt: true },
                take: 1,
              },
            },
          },
        },
      },
    },
  });

  const obligations: ComplianceObligation[] = [];

  for (const office of offices) {
    const sealedDates = office.profile.declarations
      .flatMap((d) => d.statusHistory.map((h) => h.createdAt));

    const lastSealed = sealedDates.length > 0
      ? new Date(Math.max(...sealedDates.map((d) => d.getTime())))
      : null;

    const dues = generateDueDates(office.startDate, office.endDate, today);

    for (const due of dues) {
      if (isSatisfied(due.date, sealedDates)) continue;

      const status = classifyObligation(due.date, today);
      if (status === "compliant") continue;

      const diffDays = Math.round((today.getTime() - due.date.getTime()) / 86400000);

      obligations.push({
        applicantId: office.profile.id,
        fullName: office.profile.fullName,
        ghanaCardNumber: office.profile.ghanaCardNumber,
        institution: office.institution?.name ?? null,
        institutionId: office.institution?.id ?? null,
        designation: office.designation,
        obligationType: due.type,
        dueDate: due.date,
        daysPastDue: diffDays,
        status,
        lastDeclarationDate: lastSealed?.toISOString() ?? null,
        officeStartDate: office.startDate.toISOString(),
        officeEndDate: office.endDate?.toISOString() ?? null,
      });
    }
  }

  return obligations;
}

export async function getComplianceSummary(
  scopeUserId?: string,
): Promise<ComplianceSummary> {
  const cacheKey = buildCacheKey("compliance:summary", {
    date: new Date().toISOString().slice(0, 10),
    scopeUserId: scopeUserId ?? "all",
  });

  return getCached(cacheKey, 300, async () => {
    const obligations = await computeComplianceObligations(scopeUserId);

    const totalApplicantsWithOffices = await prisma.applicantProfile.count({
      where: { offices: { some: {} } },
    });

    const upcoming = obligations.filter((o) => o.status === "upcoming").length;
    const dueNow = obligations.filter((o) => o.status === "due_now").length;
    const overdue = obligations.filter((o) => o.status === "overdue").length;
    const nonCompliant = upcoming + dueNow + overdue;
    const compliant = Math.max(0, totalApplicantsWithOffices - nonCompliant);
    const complianceRate = totalApplicantsWithOffices > 0
      ? Math.round((compliant / totalApplicantsWithOffices) * 1000) / 10
      : 0;

    return { totalApplicantsWithOffices, compliant, upcoming, dueNow, overdue, complianceRate };
  });
}

export async function getComplianceList(
  filters: ComplianceFilters,
  scopeUserId?: string,
): Promise<ComplianceListResult> {
  const cacheKey = buildCacheKey("compliance:list", {
    date: new Date().toISOString().slice(0, 10),
    scopeUserId: scopeUserId ?? "all",
    ...filters,
  });

  return getCached(cacheKey, 300, async () => {
    let obligations = await computeComplianceObligations(scopeUserId);

    if (filters.status) {
      obligations = obligations.filter((o) => o.status === filters.status);
    }

    if (filters.institutionId) {
      obligations = obligations.filter((o) => o.institutionId === filters.institutionId);
    }

    if (filters.search) {
      const term = filters.search.toLowerCase();
      obligations = obligations.filter(
        (o) =>
          o.fullName?.toLowerCase().includes(term) ||
          o.ghanaCardNumber?.toLowerCase().includes(term),
      );
    }

    const sortBy = filters.sortBy ?? "dueDate";
    const sortOrder = filters.sortOrder ?? "asc";
    const dir = sortOrder === "asc" ? 1 : -1;

    obligations.sort((a, b) => {
      switch (sortBy) {
        case "applicantName":
          return dir * (a.fullName ?? "").localeCompare(b.fullName ?? "");
        case "institution":
          return dir * (a.institution ?? "").localeCompare(b.institution ?? "");
        case "daysPastDue":
          return dir * (a.daysPastDue - b.daysPastDue);
        case "dueDate":
        default:
          return dir * (a.dueDate.getTime() - b.dueDate.getTime());
      }
    });

    const page = filters.page ?? 1;
    const pageSize = Math.min(filters.pageSize ?? 25, 100);
    const total = obligations.length;
    const start = (page - 1) * pageSize;
    const items = obligations.slice(start, start + pageSize);

    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  });
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `cd /home/jude/code/alda/app && npx nuxi typecheck 2>&1 | head -30`

Expected: No errors related to `compliance.ts`. There may be pre-existing errors in the codebase — focus only on new file errors.

- [ ] **Step 3: Commit**

```bash
cd /home/jude/code/alda
git add app/server/utils/compliance.ts
git commit -m "feat: add core compliance obligation computation utility

Generates obligation due dates from ApplicantOffice records (assumption,
every 4 years, departure) and classifies unmet obligations as upcoming,
due_now, or overdue based on a ±90 day tolerance window."
```

---

## Task 2: Compliance Summary API Endpoint

**Files:**
- Create: `app/server/api/analytics/compliance/summary.get.ts`

- [ ] **Step 1: Create the summary endpoint**

```typescript
// app/server/api/analytics/compliance/summary.get.ts
import { getRoleScope } from "~/server/utils/analytics-filters";
import { getComplianceSummary } from "~/server/utils/compliance";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const scope = await getRoleScope(event);

  if (scope.role === "applicant") {
    throw createError({ statusCode: 403, statusMessage: "Forbidden" });
  }

  const scopeUserId = scope.role === "schedule_officer" ? scope.userId : undefined;
  const data = await getComplianceSummary(scopeUserId);

  return { success: true, data };
});
```

- [ ] **Step 2: Verify the endpoint starts without errors**

Run: `cd /home/jude/code/alda/app && npx nuxi typecheck 2>&1 | grep -i compliance`

Expected: No errors mentioning compliance files.

- [ ] **Step 3: Commit**

```bash
cd /home/jude/code/alda
git add app/server/api/analytics/compliance/summary.get.ts
git commit -m "feat: add compliance summary API endpoint

GET /api/analytics/compliance/summary returns KPI counts (overdue,
due_now, upcoming, compliant, complianceRate) with role-based scoping."
```

---

## Task 3: Compliance List API Endpoint

**Files:**
- Create: `app/server/api/analytics/compliance/list.get.ts`

- [ ] **Step 1: Create the list endpoint**

```typescript
// app/server/api/analytics/compliance/list.get.ts
import { getRoleScope } from "~/server/utils/analytics-filters";
import { getComplianceList, type ComplianceFilters } from "~/server/utils/compliance";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const scope = await getRoleScope(event);

  if (scope.role === "applicant") {
    throw createError({ statusCode: 403, statusMessage: "Forbidden" });
  }

  const query = getQuery(event);

  const filters: ComplianceFilters = {};
  if (query.status && ["upcoming", "due_now", "overdue", "compliant"].includes(query.status as string)) {
    filters.status = query.status as ComplianceFilters["status"];
  }
  if (query.institutionId) {
    filters.institutionId = query.institutionId as string;
  }
  if (query.search) {
    filters.search = (query.search as string).trim();
  }
  if (query.page) {
    filters.page = Math.max(1, parseInt(query.page as string, 10) || 1);
  }
  if (query.pageSize) {
    filters.pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize as string, 10) || 25));
  }
  if (query.sortBy) {
    filters.sortBy = query.sortBy as string;
  }
  if (query.sortOrder === "asc" || query.sortOrder === "desc") {
    filters.sortOrder = query.sortOrder;
  }

  const scopeUserId = scope.role === "schedule_officer" ? scope.userId : undefined;
  const data = await getComplianceList(filters, scopeUserId);

  // Serialize dates for JSON response
  const serializedItems = data.items.map((item) => ({
    ...item,
    dueDate: item.dueDate.toISOString().slice(0, 10),
  }));

  return {
    success: true,
    data: {
      items: serializedItems,
      pagination: data.pagination,
    },
  };
});
```

- [ ] **Step 2: Commit**

```bash
cd /home/jude/code/alda
git add app/server/api/analytics/compliance/list.get.ts
git commit -m "feat: add compliance list API endpoint

GET /api/analytics/compliance/list returns paginated, filterable list of
non-compliant obligations with status, institution, and search filters."
```

---

## Task 4: Client Composable

**Files:**
- Create: `app/composables/useCompliance.ts`

Follows the exact same pattern as `app/composables/useAnalytics.ts`.

- [ ] **Step 1: Create the composable**

```typescript
// app/composables/useCompliance.ts
import { authFetch } from "~/utils/authFetch";

export interface ComplianceSummaryData {
  totalApplicantsWithOffices: number;
  compliant: number;
  upcoming: number;
  dueNow: number;
  overdue: number;
  complianceRate: number;
}

export interface ComplianceListItem {
  applicantId: string;
  fullName: string | null;
  ghanaCardNumber: string | null;
  institution: string | null;
  institutionId: string | null;
  designation: string;
  obligationType: "assumption" | "periodic" | "departure";
  dueDate: string;
  daysPastDue: number;
  status: "compliant" | "upcoming" | "due_now" | "overdue";
  lastDeclarationDate: string | null;
  officeStartDate: string;
  officeEndDate: string | null;
}

export interface ComplianceListData {
  items: ComplianceListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface ComplianceFilterState {
  status: string;
  institutionId: string;
  search: string;
  page: number;
  pageSize: number;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

function buildQueryString(params: Record<string, unknown>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      qs.set(key, String(value));
    }
  }
  const str = qs.toString();
  return str ? `?${str}` : "";
}

export function useCompliance() {
  const filters = reactive<ComplianceFilterState>({
    status: "",
    institutionId: "",
    search: "",
    page: 1,
    pageSize: 25,
    sortBy: "dueDate",
    sortOrder: "asc",
  });

  const summary = ref<ComplianceSummaryData | null>(null);
  const list = ref<ComplianceListData | null>(null);
  const loadingSummary = ref(false);
  const loadingList = ref(false);
  const error = ref<string | null>(null);

  const filterParams = computed(() => ({
    status: filters.status,
    institutionId: filters.institutionId,
    search: filters.search,
  }));

  const listParams = computed(() => ({
    ...filterParams.value,
    page: filters.page,
    pageSize: filters.pageSize,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  }));

  async function fetchSummary() {
    loadingSummary.value = true;
    try {
      const res = await authFetch<{ success: boolean; data: ComplianceSummaryData }>(
        "/api/analytics/compliance/summary",
      );
      summary.value = res.data;
    } catch (e) {
      error.value = "Failed to load compliance summary";
      console.error(e);
    } finally {
      loadingSummary.value = false;
    }
  }

  async function fetchList() {
    loadingList.value = true;
    try {
      const res = await authFetch<{ success: boolean; data: ComplianceListData }>(
        `/api/analytics/compliance/list${buildQueryString(listParams.value)}`,
      );
      list.value = res.data;
    } catch (e) {
      error.value = "Failed to load compliance list";
      console.error(e);
    } finally {
      loadingList.value = false;
    }
  }

  async function refreshAll() {
    error.value = null;
    await Promise.all([fetchSummary(), fetchList()]);
  }

  function applyFilters() {
    filters.page = 1;
    refreshAll();
  }

  function resetFilters() {
    filters.status = "";
    filters.institutionId = "";
    filters.search = "";
    filters.page = 1;
    refreshAll();
  }

  function setPage(p: number) {
    filters.page = p;
    fetchList();
  }

  function setSort(column: string) {
    if (filters.sortBy === column) {
      filters.sortOrder = filters.sortOrder === "asc" ? "desc" : "asc";
    } else {
      filters.sortBy = column;
      filters.sortOrder = "asc";
    }
    filters.page = 1;
    fetchList();
  }

  onMounted(refreshAll);

  return {
    filters,
    summary,
    list,
    loadingSummary,
    loadingList,
    error,
    applyFilters,
    resetFilters,
    refreshAll,
    fetchList,
    setPage,
    setSort,
  };
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/jude/code/alda
git add app/composables/useCompliance.ts
git commit -m "feat: add useCompliance composable

Manages compliance summary/list fetching, filters, pagination, and
sorting following the same pattern as useAnalytics.ts."
```

---

## Task 5: ComplianceKpiCards Component

**Files:**
- Create: `app/components/compliance/ComplianceKpiCards.vue`

- [ ] **Step 1: Create the KPI cards component**

```vue
<!-- app/components/compliance/ComplianceKpiCards.vue -->
<script setup lang="ts">
import type { ComplianceSummaryData } from "~/composables/useCompliance";

defineProps<{
  data: ComplianceSummaryData | null;
  loading: boolean;
  complianceHref?: string;
}>();

const cards = computed(() => [
  {
    label: "Overdue",
    key: "overdue" as const,
    borderColor: "border-l-red-500",
    valueColor: "text-red-600 dark:text-red-400",
    iconBg: "bg-red-100 dark:bg-red-950/50",
  },
  {
    label: "Due Now",
    key: "dueNow" as const,
    borderColor: "border-l-amber-500",
    valueColor: "text-amber-600 dark:text-amber-400",
    iconBg: "bg-amber-100 dark:bg-amber-950/50",
  },
  {
    label: "Upcoming",
    key: "upcoming" as const,
    borderColor: "border-l-blue-500",
    valueColor: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-blue-100 dark:bg-blue-950/50",
  },
  {
    label: "Compliance Rate",
    key: "complianceRate" as const,
    borderColor: "border-l-green-500",
    valueColor: "text-green-600 dark:text-green-400",
    iconBg: "bg-green-100 dark:bg-green-950/50",
  },
]);
</script>

<template>
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
    <NuxtLink
      v-for="card in cards"
      :key="card.key"
      :to="complianceHref ? `${complianceHref}${card.key !== 'complianceRate' ? `?status=${card.key === 'dueNow' ? 'due_now' : card.key}` : ''}` : undefined"
    >
      <Card class="border-l-4 hover:border-primary/50 transition-colors h-full" :class="card.borderColor">
        <CardContent class="p-4">
          <Skeleton v-if="loading" class="h-4 w-20 mb-2" />
          <Skeleton v-if="loading" class="h-8 w-16" />
          <template v-else>
            <p class="text-xs text-muted-foreground uppercase tracking-wide">
              {{ card.label }}
            </p>
            <p class="text-2xl font-extrabold mt-1" :class="card.valueColor">
              {{ card.key === "complianceRate"
                ? `${data?.complianceRate ?? 0}%`
                : (data?.[card.key] ?? 0).toLocaleString()
              }}
            </p>
            <p v-if="card.key !== 'complianceRate'" class="text-xs text-muted-foreground mt-1">
              obligations
            </p>
            <p v-else class="text-xs text-muted-foreground mt-1">
              of {{ data?.totalApplicantsWithOffices ?? 0 }} office holders
            </p>
          </template>
        </CardContent>
      </Card>
    </NuxtLink>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
cd /home/jude/code/alda
git add app/components/compliance/ComplianceKpiCards.vue
git commit -m "feat: add ComplianceKpiCards component

4-card grid showing overdue (red), due now (amber), upcoming (blue),
and compliance rate (green) with links to filtered compliance page."
```

---

## Task 6: ComplianceFilterBar Component

**Files:**
- Create: `app/components/compliance/ComplianceFilterBar.vue`

- [ ] **Step 1: Create the filter bar component**

```vue
<!-- app/components/compliance/ComplianceFilterBar.vue -->
<script setup lang="ts">
import type { ComplianceFilterState } from "~/composables/useCompliance";
import { authFetch } from "~/utils/authFetch";

defineProps<{
  filters: ComplianceFilterState;
}>();

const emit = defineEmits<{
  apply: [];
  reset: [];
}>();

interface SelectOption {
  id: string;
  name: string;
}

const institutions = ref<SelectOption[]>([]);

onMounted(async () => {
  try {
    const res = await authFetch<{ success: boolean; data: SelectOption[] } | SelectOption[]>(
      "/api/institutions",
    );
    if (Array.isArray(res)) {
      institutions.value = res;
    } else if (res.data) {
      institutions.value = res.data;
    }
  } catch {
    // Filter dropdown degrades gracefully
  }
});

const statusOptions = [
  { value: "", label: "All Statuses" },
  { value: "overdue", label: "Overdue" },
  { value: "due_now", label: "Due Now" },
  { value: "upcoming", label: "Upcoming" },
];
</script>

<template>
  <Card>
    <CardContent class="p-4">
      <div class="flex flex-wrap items-center gap-3">
        <!-- Status Filter -->
        <select
          v-model="filters.status"
          class="h-8 rounded-md border bg-background px-3 text-xs"
          @change="emit('apply')"
        >
          <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>

        <!-- Institution Filter -->
        <select
          v-model="filters.institutionId"
          class="h-8 rounded-md border bg-background px-3 text-xs"
          @change="emit('apply')"
        >
          <option value="">All Institutions</option>
          <option v-for="inst in institutions" :key="inst.id" :value="inst.id">
            {{ inst.name }}
          </option>
        </select>

        <!-- Search -->
        <div class="flex-1 min-w-[200px]">
          <Input
            v-model="filters.search"
            placeholder="Search by name or Ghana Card..."
            class="h-8 text-xs"
            @keyup.enter="emit('apply')"
          />
        </div>

        <!-- Actions -->
        <div class="flex gap-2">
          <Button size="sm" variant="outline" class="h-8 text-xs" @click="emit('reset')">
            Reset
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
```

- [ ] **Step 2: Commit**

```bash
cd /home/jude/code/alda
git add app/components/compliance/ComplianceFilterBar.vue
git commit -m "feat: add ComplianceFilterBar component

Status dropdown, institution dropdown, and search input for filtering
the compliance obligations list."
```

---

## Task 7: ComplianceTable Component

**Files:**
- Create: `app/components/compliance/ComplianceTable.vue`

- [ ] **Step 1: Create the table component**

```vue
<!-- app/components/compliance/ComplianceTable.vue -->
<script setup lang="ts">
import type { ComplianceListData } from "~/composables/useCompliance";
import { TONE_BADGE } from "~/utils/statusStyles";

defineProps<{
  data: ComplianceListData | null;
  loading: boolean;
  sortBy: string;
  sortOrder: "asc" | "desc";
}>();

const emit = defineEmits<{
  sort: [column: string];
  page: [page: number];
}>();

const columns = [
  { key: "fullName", label: "Applicant", sortable: true, sortKey: "applicantName" },
  { key: "ghanaCardNumber", label: "Ghana Card", sortable: false },
  { key: "institution", label: "Institution", sortable: true },
  { key: "designation", label: "Designation", sortable: false },
  { key: "obligationType", label: "Obligation", sortable: false },
  { key: "dueDate", label: "Due Date", sortable: true },
  { key: "status", label: "Status", sortable: false },
  { key: "daysPastDue", label: "Days", sortable: true },
  { key: "lastDeclarationDate", label: "Last Declaration", sortable: false },
];

const statusBadge: Record<string, { label: string; class: string }> = {
  overdue: { label: "Overdue", class: TONE_BADGE.red! },
  due_now: { label: "Due Now", class: TONE_BADGE.amber! },
  upcoming: { label: "Upcoming", class: TONE_BADGE.blue! },
  compliant: { label: "Compliant", class: TONE_BADGE.green! },
};

const obligationLabel: Record<string, string> = {
  assumption: "Assumption of Office",
  periodic: "Periodic (4-year)",
  departure: "Departure from Office",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDays(days: number): string {
  if (days < 0) return `in ${Math.abs(days)} days`;
  if (days === 0) return "Today";
  return `${days} days ago`;
}
</script>

<template>
  <Card>
    <CardHeader class="flex flex-row items-center justify-between">
      <div>
        <CardTitle class="text-base">Declaration Obligations</CardTitle>
        <CardDescription v-if="data">
          Showing {{ ((data.pagination.page - 1) * data.pagination.pageSize) + 1 }}–{{
            Math.min(data.pagination.page * data.pagination.pageSize, data.pagination.total)
          }} of {{ data.pagination.total.toLocaleString() }}
        </CardDescription>
      </div>
    </CardHeader>
    <CardContent>
      <Skeleton v-if="loading" class="w-full h-[400px]" />
      <div v-else-if="data && data.items.length > 0" class="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                v-for="col in columns"
                :key="col.key"
                :class="col.sortable ? 'cursor-pointer select-none hover:text-foreground' : ''"
                @click="col.sortable ? emit('sort', col.sortKey ?? col.key) : undefined"
              >
                {{ col.label }}
                <span v-if="col.sortable && sortBy === (col.sortKey ?? col.key)" class="ml-1">
                  {{ sortOrder === 'asc' ? '↑' : '↓' }}
                </span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(item, idx) in data.items" :key="idx">
              <TableCell>{{ item.fullName ?? "—" }}</TableCell>
              <TableCell class="font-mono text-xs">{{ item.ghanaCardNumber ?? "—" }}</TableCell>
              <TableCell class="max-w-[180px] truncate" :title="item.institution ?? ''">
                {{ item.institution ?? "—" }}
              </TableCell>
              <TableCell>{{ item.designation }}</TableCell>
              <TableCell>
                <span class="text-xs">{{ obligationLabel[item.obligationType] ?? item.obligationType }}</span>
              </TableCell>
              <TableCell>{{ formatDate(item.dueDate) }}</TableCell>
              <TableCell>
                <Badge :class="statusBadge[item.status]?.class ?? ''">
                  {{ statusBadge[item.status]?.label ?? item.status }}
                </Badge>
              </TableCell>
              <TableCell :class="item.daysPastDue > 90 ? 'text-red-600 dark:text-red-400 font-medium' : item.daysPastDue > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'">
                {{ formatDays(item.daysPastDue) }}
              </TableCell>
              <TableCell>{{ formatDate(item.lastDeclarationDate) }}</TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <!-- Pagination -->
        <div
          v-if="data.pagination.totalPages > 1"
          class="flex justify-center gap-1 mt-4"
        >
          <Button
            v-for="p in data.pagination.totalPages"
            :key="p"
            size="sm"
            :variant="p === data.pagination.page ? 'default' : 'outline'"
            class="h-8 w-8 text-xs"
            @click="emit('page', p)"
          >
            {{ p }}
          </Button>
        </div>
      </div>
      <div v-else class="text-center text-muted-foreground py-12">
        No non-compliant obligations found matching the current filters.
      </div>
    </CardContent>
  </Card>
</template>
```

- [ ] **Step 2: Commit**

```bash
cd /home/jude/code/alda
git add app/components/compliance/ComplianceTable.vue
git commit -m "feat: add ComplianceTable component

Paginated data table with sortable columns, colored status badges,
and human-readable days display for compliance obligations."
```

---

## Task 8: Admin Compliance Page

**Files:**
- Create: `app/pages/admin/compliance.vue`

- [ ] **Step 1: Create the admin compliance page**

```vue
<!-- app/pages/admin/compliance.vue -->
<script setup lang="ts">
definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const {
  filters,
  summary,
  list,
  loadingSummary,
  loadingList,
  applyFilters,
  resetFilters,
  setPage,
  setSort,
} = useCompliance();
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Declaration Compliance"
      description="Monitor public office holders' compliance with Article 286(5) declaration obligations"
    />

    <ComplianceKpiCards
      :data="summary"
      :loading="loadingSummary"
    />

    <ComplianceFilterBar
      :filters="filters"
      @apply="applyFilters"
      @reset="resetFilters"
    />

    <ComplianceTable
      :data="list"
      :loading="loadingList"
      :sort-by="filters.sortBy"
      :sort-order="filters.sortOrder"
      @sort="setSort"
      @page="setPage"
    />
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
cd /home/jude/code/alda
git add app/pages/admin/compliance.vue
git commit -m "feat: add admin compliance page

Full compliance monitoring page at /admin/compliance with KPI cards,
filters, and paginated obligations table."
```

---

## Task 9: Officer and Legal Compliance Pages

**Files:**
- Create: `app/pages/officer/compliance.vue`
- Create: `app/pages/legal/compliance.vue`

These are identical in structure to the admin page — data is role-scoped on the server side.

- [ ] **Step 1: Create the officer compliance page**

```vue
<!-- app/pages/officer/compliance.vue -->
<script setup lang="ts">
definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const {
  filters,
  summary,
  list,
  loadingSummary,
  loadingList,
  applyFilters,
  resetFilters,
  setPage,
  setSort,
} = useCompliance();
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Declaration Compliance"
      description="Monitor declaration compliance for applicants you have processed"
    />

    <ComplianceKpiCards
      :data="summary"
      :loading="loadingSummary"
    />

    <ComplianceFilterBar
      :filters="filters"
      @apply="applyFilters"
      @reset="resetFilters"
    />

    <ComplianceTable
      :data="list"
      :loading="loadingList"
      :sort-by="filters.sortBy"
      :sort-order="filters.sortOrder"
      @sort="setSort"
      @page="setPage"
    />
  </div>
</template>
```

- [ ] **Step 2: Create the legal compliance page**

```vue
<!-- app/pages/legal/compliance.vue -->
<script setup lang="ts">
definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const {
  filters,
  summary,
  list,
  loadingSummary,
  loadingList,
  applyFilters,
  resetFilters,
  setPage,
  setSort,
} = useCompliance();
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Declaration Compliance"
      description="Compliance oversight — all public office holder declaration obligations"
    />

    <ComplianceKpiCards
      :data="summary"
      :loading="loadingSummary"
    />

    <ComplianceFilterBar
      :filters="filters"
      @apply="applyFilters"
      @reset="resetFilters"
    />

    <ComplianceTable
      :data="list"
      :loading="loadingList"
      :sort-by="filters.sortBy"
      :sort-order="filters.sortOrder"
      @sort="setSort"
      @page="setPage"
    />
  </div>
</template>
```

- [ ] **Step 3: Commit**

```bash
cd /home/jude/code/alda
git add app/pages/officer/compliance.vue app/pages/legal/compliance.vue
git commit -m "feat: add officer and legal compliance pages

Same structure as admin, but data is role-scoped on the server side.
Officer sees only their processed applicants; legal sees all."
```

---

## Task 10: Dashboard Integration — Admin

**Files:**
- Modify: `app/pages/admin/dashboard.vue`

Add a compliance summary section between the existing system stats and the code lifecycle card.

- [ ] **Step 1: Add compliance data fetching to the admin dashboard**

In `app/pages/admin/dashboard.vue`, add below the existing `useDashboardStats` call (after line 67):

```typescript
const { data: complianceSummary, loading: complianceLoading } = useDashboardStats<{
  totalApplicantsWithOffices: number;
  compliant: number;
  upcoming: number;
  dueNow: number;
  overdue: number;
  complianceRate: number;
}>("/api/analytics/compliance/summary");
```

- [ ] **Step 2: Add the compliance KPI section to the template**

In the template, after the closing `</div>` of the "System Stats" grid (after line 275), add:

```vue
    <!-- Declaration Compliance -->
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold text-foreground">Declaration Compliance</h2>
      <NuxtLink to="/admin/compliance" class="text-sm text-primary hover:underline">
        View Details →
      </NuxtLink>
    </div>
    <ComplianceKpiCards
      :data="complianceSummary"
      :loading="complianceLoading"
      compliance-href="/admin/compliance"
    />
```

- [ ] **Step 3: Verify the page renders**

Run: `cd /home/jude/code/alda/app && npx nuxi typecheck 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
cd /home/jude/code/alda
git add app/pages/admin/dashboard.vue
git commit -m "feat: add compliance KPI cards to admin dashboard

Shows overdue, due now, upcoming counts and compliance rate with links
to the full compliance page."
```

---

## Task 11: Dashboard Integration — Officer

**Files:**
- Modify: `app/pages/officer/dashboard.vue`

- [ ] **Step 1: Add compliance data fetching**

In `app/pages/officer/dashboard.vue`, add after the existing `useDashboardStats` call (after line 21):

```typescript
const { data: complianceSummary, loading: complianceLoading } = useDashboardStats<{
  totalApplicantsWithOffices: number;
  compliant: number;
  upcoming: number;
  dueNow: number;
  overdue: number;
  complianceRate: number;
}>("/api/analytics/compliance/summary");
```

- [ ] **Step 2: Add the compliance KPI section to the template**

In the template, after `<AnalyticsSealedSummaryWidget role="officer" />` (after line 96), add:

```vue
    <!-- Declaration Compliance -->
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold text-foreground">Declaration Compliance</h2>
      <NuxtLink to="/officer/compliance" class="text-sm text-primary hover:underline">
        View Details →
      </NuxtLink>
    </div>
    <ComplianceKpiCards
      :data="complianceSummary"
      :loading="complianceLoading"
      compliance-href="/officer/compliance"
    />
```

- [ ] **Step 3: Commit**

```bash
cd /home/jude/code/alda
git add app/pages/officer/dashboard.vue
git commit -m "feat: add compliance KPI cards to officer dashboard"
```

---

## Task 12: Dashboard Integration — Legal

**Files:**
- Modify: `app/pages/legal/dashboard.vue`

- [ ] **Step 1: Add compliance data fetching**

In `app/pages/legal/dashboard.vue`, add after the existing `useDashboardStats` call (after line 43):

```typescript
const { data: complianceSummary, loading: complianceLoading } = useDashboardStats<{
  totalApplicantsWithOffices: number;
  compliant: number;
  upcoming: number;
  dueNow: number;
  overdue: number;
  complianceRate: number;
}>("/api/analytics/compliance/summary");
```

- [ ] **Step 2: Add the compliance KPI section to the template**

In the template, after `<AnalyticsSealedSummaryWidget role="legal" />` (after line 92), add:

```vue
    <!-- Declaration Compliance -->
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold text-foreground">Declaration Compliance</h2>
      <NuxtLink to="/legal/compliance" class="text-sm text-primary hover:underline">
        View Details →
      </NuxtLink>
    </div>
    <ComplianceKpiCards
      :data="complianceSummary"
      :loading="complianceLoading"
      compliance-href="/legal/compliance"
    />
```

- [ ] **Step 3: Commit**

```bash
cd /home/jude/code/alda
git add app/pages/legal/dashboard.vue
git commit -m "feat: add compliance KPI cards to legal dashboard"
```

---

## Task 13: Sidebar Navigation Links

**Files:**
- Modify: `app/layouts/dashboard.vue`

- [ ] **Step 1: Add compliance nav items for each role**

In `app/layouts/dashboard.vue`, modify the navigation computed property:

For the **officer** section (around line 63), add before the Analytics item:

```typescript
      { name: "Compliance", href: "/officer/compliance", icon: "clipboard-check", tour: "nav-compliance" },
```

For the **legal** section (around line 74), add before the Analytics item:

```typescript
      { name: "Compliance", href: "/legal/compliance", icon: "clipboard-check", tour: "nav-compliance" },
```

For the **admin** section (around line 89), add before the Analytics item:

```typescript
      { name: "Compliance", href: "/admin/compliance", icon: "clipboard-check", tour: "nav-compliance" },
```

- [ ] **Step 2: Commit**

```bash
cd /home/jude/code/alda
git add app/layouts/dashboard.vue
git commit -m "feat: add compliance nav links to admin/officer/legal sidebars"
```

---

## Task 14: Smoke Test — Dev Server Verification

- [ ] **Step 1: Run lint**

Run: `cd /home/jude/code/alda/app && npm run lint`

Expected: No new lint errors from compliance files. Fix any that appear.

- [ ] **Step 2: Start dev server and verify pages load**

Run: `cd /home/jude/code/alda/app && npm run dev`

Then verify in the browser:
1. Login as admin → navigate to `/admin/dashboard` → verify compliance KPI cards appear
2. Click "View Details" → verify `/admin/compliance` page loads with table
3. Test status filter dropdown, institution dropdown, search
4. Test pagination if there are enough records
5. Repeat for officer and legal roles

- [ ] **Step 3: Fix any issues found during manual testing**

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
cd /home/jude/code/alda
git add -A
git commit -m "fix: address issues found during compliance feature smoke test"
```
