# Sealed Declarations Analytics Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a comprehensive management dashboard for sealed declarations with Redis-cached KPI/chart aggregations, live detail tables, search, filters, CSV/PDF export, and summary widgets on all role dashboards.

**Architecture:** Hybrid caching — Redis (5-min TTL) for expensive aggregations (KPIs, charts), live Prisma queries for detail table and exports. Four API endpoints under `/api/analytics/declarations/`. Role-scoped access for all 4 roles. Summary widgets embedded in each role's existing dashboard page.

**Tech Stack:** Nuxt 4, Prisma (PostgreSQL), ioredis, ApexCharts (vue3-apexcharts), shadcn-vue, pdf-lib, Tailwind v4

**Spec:** `docs/superpowers/specs/2026-05-21-sealed-declarations-analytics-dashboard-design.md` (on branch `claude/redesign-declaration-workflow`, commit `df3abf9`)

---

## File Structure

### New Files

```
app/server/utils/redis.ts                               — Redis singleton (globalThis pattern)
app/server/utils/analytics-cache.ts                      — getCached<T>(key, ttl, fn) wrapper
app/server/utils/analytics-filters.ts                    — Shared filter parsing + role scoping
app/server/api/analytics/declarations/summary.get.ts     — KPI cards (cached)
app/server/api/analytics/declarations/charts.get.ts      — All 4 charts (cached)
app/server/api/analytics/declarations/list.get.ts        — Detail table (live, paginated)
app/server/api/analytics/declarations/export.get.ts      — CSV/PDF export (live)
app/composables/useAnalytics.ts                          — Reactive filter state + 3 fetch calls
app/components/analytics/FilterBar.vue                   — Global filter bar with presets
app/components/analytics/KpiCards.vue                    — 5 KPI stat cards with trends
app/components/analytics/SealedTimelineChart.vue         — Area chart (monthly trend)
app/components/analytics/InstitutionChart.vue            — Horizontal bar (top 10)
app/components/analytics/CollectionOfficeChart.vue       — Donut + bar (region)
app/components/analytics/OfficerPerformanceChart.vue     — Mixed bar + line
app/components/analytics/DeclarationsTable.vue           — Paginated sortable table
app/components/analytics/SealedSummaryWidget.vue         — Compact widget for dashboards
app/pages/admin/analytics.vue                            — Admin full analytics page
app/pages/officer/analytics.vue                          — Officer analytics (scoped)
app/pages/legal/analytics.vue                            — Legal analytics (read-only)
app/pages/applicant/analytics.vue                        — Applicant analytics (own data)
```

### Modified Files

```
app/package.json                       — Add ioredis + @types/ioredis
app/nuxt.config.ts                     — Add redisUrl to runtimeConfig
app/prisma/schema.prisma               — Add 2 indexes (status already indexed)
app/server/middleware/auth.ts           — Add /api/analytics route permissions
app/layouts/dashboard.vue              — Add Analytics nav link per role
app/pages/admin/dashboard.vue          — Add SealedSummaryWidget
app/pages/officer/dashboard.vue        — Add SealedSummaryWidget
app/pages/legal/dashboard.vue          — Add SealedSummaryWidget
app/pages/applicant/dashboard.vue      — Add SealedSummaryWidget
```

---

## Task 1: Install ioredis and Configure Redis

**Files:**
- Modify: `app/package.json`
- Modify: `app/nuxt.config.ts`

- [ ] **Step 1: Install ioredis**

Run from `app/`:
```bash
npm install ioredis
npm install -D @types/ioredis
```

- [ ] **Step 2: Add redisUrl to runtimeConfig**

In `app/nuxt.config.ts`, add `redisUrl` to the server-side `runtimeConfig` block (after the `smtpFrom` line):

```typescript
    // Redis
    redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
```

- [ ] **Step 3: Verify config compiles**

Run from `app/`:
```bash
npx nuxi typecheck
```
Expected: no errors related to runtimeConfig

- [ ] **Step 4: Commit**

```bash
git add app/package.json app/package-lock.json app/nuxt.config.ts
git commit -m "feat(analytics): install ioredis and add redisUrl to runtimeConfig"
```

---

## Task 2: Redis Singleton and Cache Utility

**Files:**
- Create: `app/server/utils/redis.ts`
- Create: `app/server/utils/analytics-cache.ts`

- [ ] **Step 1: Create Redis singleton**

Create `app/server/utils/redis.ts`:

```typescript
import Redis from "ioredis";

declare global {
  // eslint-disable-next-line no-var
  var __redis: Redis | undefined;
}

function createRedisClient(): Redis {
  const config = useRuntimeConfig();
  return new Redis(config.redisUrl, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });
}

export const redis = globalThis.__redis || createRedisClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__redis = redis;
}

export default redis;
```

- [ ] **Step 2: Create analytics cache utility**

Create `app/server/utils/analytics-cache.ts`:

```typescript
import crypto from "node:crypto";
import redis from "./redis";

export function buildCacheKey(prefix: string, params: Record<string, unknown>): string {
  const sorted = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .sort(([a], [b]) => a.localeCompare(b));
  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify(sorted))
    .digest("hex")
    .slice(0, 12);
  return `analytics:decl:${prefix}:${hash}`;
}

export async function getCached<T>(
  key: string,
  ttlSeconds: number,
  computeFn: () => Promise<T>,
): Promise<T> {
  try {
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch {
    // Redis unavailable — fall through to compute
  }

  const result = await computeFn();

  try {
    await redis.set(key, JSON.stringify(result), "EX", ttlSeconds);
  } catch {
    // Redis unavailable — result still returned
  }

  return result;
}
```

- [ ] **Step 3: Verify files compile**

Run from `app/`:
```bash
npx nuxi typecheck
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add app/server/utils/redis.ts app/server/utils/analytics-cache.ts
git commit -m "feat(analytics): add Redis singleton and getCached utility"
```

---

## Task 3: Database Indexes and Auth Middleware

**Files:**
- Modify: `app/prisma/schema.prisma`
- Modify: `app/server/middleware/auth.ts`

- [ ] **Step 1: Add analytics indexes to schema**

In `app/prisma/schema.prisma`, add a compound index to `DeclarationStatusHistory` (after the existing `@@index([createdAt])` on line 305):

```prisma
  @@index([status, createdAt])
```

Add an index to `FormCollection` (after the existing `@@index([declarationId])` on line 338):

```prisma
  @@index([collectionOfficeId])
```

Note: `Declaration` already has `@@index([status])` on line 288.

- [ ] **Step 2: Run migration**

Run from `app/`:
```bash
npx prisma migrate dev --name add_analytics_indexes
```
Expected: migration created and applied successfully

- [ ] **Step 3: Update auth middleware for analytics routes**

In `app/server/middleware/auth.ts`, the `/api/analytics` routes need to be accessible by all authenticated users (role filtering happens inside each handler). The current middleware already allows all authenticated users through to non-prefixed routes — `/api/analytics` doesn't match any of the existing `roleProtectedRoutes` prefixes (`/api/admin`, `/api/officer`, `/api/legal`), so **no middleware change is needed**. All authenticated users can already reach `/api/analytics/*`.

Verify this by checking that the path `/api/analytics/declarations/summary` does NOT start with any of the keys in `roleProtectedRoutes`.

- [ ] **Step 4: Commit**

```bash
git add app/prisma/schema.prisma app/prisma/migrations/
git commit -m "feat(analytics): add database indexes for analytics queries"
```

---

## Task 4: Shared Filter Parsing and Role Scoping

**Files:**
- Create: `app/server/utils/analytics-filters.ts`

- [ ] **Step 1: Create shared filter utility**

Create `app/server/utils/analytics-filters.ts`:

```typescript
import type { H3Event } from "h3";
import type { Prisma } from "@prisma/client";
import prisma from "./prisma";

export interface AnalyticsFilters {
  dateFrom?: Date;
  dateTo?: Date;
  officeId?: string;
  collectionOfficeId?: string;
  officerId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export function parseFilters(event: H3Event): AnalyticsFilters {
  const query = getQuery(event);

  const filters: AnalyticsFilters = {};

  if (query.dateFrom) {
    filters.dateFrom = new Date(query.dateFrom as string);
  }
  if (query.dateTo) {
    const d = new Date(query.dateTo as string);
    d.setHours(23, 59, 59, 999);
    filters.dateTo = d;
  }
  if (query.officeId) {
    filters.officeId = query.officeId as string;
  }
  if (query.collectionOfficeId) {
    filters.collectionOfficeId = query.collectionOfficeId as string;
  }
  if (query.officerId) {
    filters.officerId = query.officerId as string;
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

  return filters;
}

export interface RoleScope {
  role: string;
  userId: string;
  applicantProfileId?: string;
}

export async function getRoleScope(event: H3Event): Promise<RoleScope> {
  const auth = event.context.auth!;

  const roles = auth.roles as string[];
  if (roles.includes("admin")) {
    return { role: "admin", userId: auth.userId };
  }
  if (roles.includes("schedule_officer")) {
    return { role: "schedule_officer", userId: auth.userId };
  }
  if (roles.includes("legal_unit")) {
    return { role: "legal_unit", userId: auth.userId };
  }

  // Applicant — need their profile ID
  const profile = await prisma.applicantProfile.findUnique({
    where: { userId: auth.userId },
    select: { id: true },
  });

  return {
    role: "applicant",
    userId: auth.userId,
    applicantProfileId: profile?.id,
  };
}

export function buildSealedHistoryWhere(
  filters: AnalyticsFilters,
  scope: RoleScope,
): Prisma.DeclarationStatusHistoryWhereInput {
  const where: Prisma.DeclarationStatusHistoryWhereInput = {
    status: "SEALED",
  };

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
    if (filters.dateTo) where.createdAt.lte = filters.dateTo;
  }

  if (filters.officerId) {
    where.changedById = filters.officerId;
  }

  if (scope.role === "schedule_officer") {
    where.changedById = scope.userId;
  }

  if (scope.role === "applicant" && scope.applicantProfileId) {
    where.declaration = { applicantId: scope.applicantProfileId };
  }

  if (filters.officeId) {
    where.declaration = {
      ...where.declaration as Prisma.DeclarationWhereInput,
      applicant: {
        offices: { some: { institutionId: filters.officeId } },
      },
    };
  }

  if (filters.collectionOfficeId) {
    where.declaration = {
      ...where.declaration as Prisma.DeclarationWhereInput,
      OR: [
        { returnOfficeId: filters.collectionOfficeId },
        { formCollections: { some: { collectionOfficeId: filters.collectionOfficeId } } },
      ],
    };
  }

  if (filters.search) {
    const searchTerm = filters.search;
    where.declaration = {
      ...where.declaration as Prisma.DeclarationWhereInput,
      OR: [
        { uniqueCode: { contains: searchTerm, mode: "insensitive" } },
        { applicant: { fullName: { contains: searchTerm, mode: "insensitive" } } },
        { applicant: { ghanaCardNumber: { contains: searchTerm, mode: "insensitive" } } },
      ],
    };
  }

  return where;
}

export function getComparisonDateRange(
  dateFrom?: Date,
  dateTo?: Date,
): { prevFrom: Date; prevTo: Date } | null {
  if (!dateFrom && !dateTo) {
    // "All Time" → compare current year vs previous year
    const now = new Date();
    const currentYearStart = new Date(now.getFullYear(), 0, 1);
    const prevYearStart = new Date(now.getFullYear() - 1, 0, 1);
    const prevYearEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
    return { prevFrom: prevYearStart, prevTo: prevYearEnd };
  }

  if (dateFrom && dateTo) {
    const rangeMs = dateTo.getTime() - dateFrom.getTime();
    const prevTo = new Date(dateFrom.getTime() - 1);
    prevTo.setHours(23, 59, 59, 999);
    const prevFrom = new Date(prevTo.getTime() - rangeMs);
    prevFrom.setHours(0, 0, 0, 0);
    return { prevFrom, prevTo };
  }

  return null;
}
```

- [ ] **Step 2: Verify types compile**

Run from `app/`:
```bash
npx nuxi typecheck
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add app/server/utils/analytics-filters.ts
git commit -m "feat(analytics): add shared filter parsing and role scoping utilities"
```

---

## Task 5: Summary API Endpoint

**Files:**
- Create: `app/server/api/analytics/declarations/summary.get.ts`

- [ ] **Step 1: Create the summary endpoint**

Create `app/server/api/analytics/declarations/summary.get.ts`:

```typescript
import prisma from "~/server/utils/prisma";
import { getCached, buildCacheKey } from "~/server/utils/analytics-cache";
import {
  parseFilters,
  getRoleScope,
  buildSealedHistoryWhere,
  getComparisonDateRange,
} from "~/server/utils/analytics-filters";

interface SummaryData {
  totalSealed: number;
  avgProcessingDays: number;
  officesCovered: number;
  totalOffices: number;
  formReissueRate: number;
  rejectionRate: number;
  comparisons: {
    totalSealed: { previous: number; changePercent: number | null };
    avgProcessingDays: { previous: number; changePercent: number | null };
    rejectionRate: { previous: number; changePercent: number | null };
  };
}

async function computeAvgProcessingDays(
  where: Record<string, unknown>,
): Promise<number> {
  const rows = await prisma.$queryRaw<{ avg_days: number }[]>`
    SELECT COALESCE(AVG(
      EXTRACT(EPOCH FROM (sealed.created_at - created_entry.created_at)) / 86400.0
    ), 0) AS avg_days
    FROM declaration_status_history sealed
    JOIN (
      SELECT declaration_id, MIN(created_at) AS created_at
      FROM declaration_status_history
      WHERE status = 'CODE_GENERATED'
      GROUP BY declaration_id
    ) created_entry ON sealed.declaration_id = created_entry.declaration_id
    WHERE sealed.status = 'SEALED'
      AND (${where.dateFrom}::timestamptz IS NULL OR sealed.created_at >= ${where.dateFrom}::timestamptz)
      AND (${where.dateTo}::timestamptz IS NULL OR sealed.created_at <= ${where.dateTo}::timestamptz)
      AND (${where.changedById}::uuid IS NULL OR sealed.changed_by_id = ${where.changedById}::uuid)
  `;
  return Math.round((rows[0]?.avg_days ?? 0) * 10) / 10;
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const filters = parseFilters(event);
  const scope = await getRoleScope(event);
  const where = buildSealedHistoryWhere(filters, scope);

  const cacheKey = buildCacheKey("summary", {
    ...filters,
    role: scope.role,
    userId: scope.role === "admin" || scope.role === "legal_unit" ? undefined : scope.userId,
  });

  const data = await getCached<SummaryData>(cacheKey, 300, async () => {
    const [
      totalSealed,
      totalOffices,
      totalDeclarations,
      rejectedCount,
    ] = await Promise.all([
      prisma.declarationStatusHistory.count({ where }),
      prisma.institution.count({ where: { isActive: true } }),
      prisma.declaration.count(),
      prisma.declaration.count({ where: { status: "REJECTED" } }),
    ]);

    // Offices covered: distinct institutions with sealed declarations
    const sealedDeclarationIds = await prisma.declarationStatusHistory.findMany({
      where,
      select: { declarationId: true },
      distinct: ["declarationId"],
    });
    const declIds = sealedDeclarationIds.map((d) => d.declarationId);

    let officesCovered = 0;
    if (declIds.length > 0) {
      const offices = await prisma.applicantOffice.findMany({
        where: {
          profile: { declarations: { some: { id: { in: declIds } } } },
          institutionId: { not: null },
        },
        select: { institutionId: true },
        distinct: ["institutionId"],
      });
      officesCovered = offices.length;
    }

    // Form reissue rate
    let formReissueRate = 0;
    if (declIds.length > 0) {
      const reissueCount = await prisma.formReissueRequest.count({
        where: {
          declarationId: { in: declIds },
          status: "APPROVED",
        },
      });
      formReissueRate =
        totalSealed > 0
          ? Math.round((reissueCount / totalSealed) * 1000) / 10
          : 0;
    }

    const rejectionRate =
      totalDeclarations > 0
        ? Math.round((rejectedCount / totalDeclarations) * 1000) / 10
        : 0;

    const avgProcessingDays = await computeAvgProcessingDays({
      dateFrom: filters.dateFrom ?? null,
      dateTo: filters.dateTo ?? null,
      changedById:
        scope.role === "schedule_officer" ? scope.userId : null,
    });

    // Comparison period
    const compRange = getComparisonDateRange(filters.dateFrom, filters.dateTo);
    let comparisons: SummaryData["comparisons"] = {
      totalSealed: { previous: 0, changePercent: null },
      avgProcessingDays: { previous: 0, changePercent: null },
      rejectionRate: { previous: 0, changePercent: null },
    };

    if (compRange) {
      const prevWhere = { ...where };
      prevWhere.createdAt = { gte: compRange.prevFrom, lte: compRange.prevTo };

      const [prevSealed, prevRejected, prevTotal] = await Promise.all([
        prisma.declarationStatusHistory.count({ where: prevWhere }),
        prisma.declaration.count({
          where: {
            status: "REJECTED",
            createdAt: { gte: compRange.prevFrom, lte: compRange.prevTo },
          },
        }),
        prisma.declaration.count({
          where: {
            createdAt: { gte: compRange.prevFrom, lte: compRange.prevTo },
          },
        }),
      ]);

      const prevAvg = await computeAvgProcessingDays({
        dateFrom: compRange.prevFrom,
        dateTo: compRange.prevTo,
        changedById:
          scope.role === "schedule_officer" ? scope.userId : null,
      });

      const prevRejRate =
        prevTotal > 0
          ? Math.round((prevRejected / prevTotal) * 1000) / 10
          : 0;

      const pct = (curr: number, prev: number) =>
        prev > 0 ? Math.round(((curr - prev) / prev) * 1000) / 10 : null;

      comparisons = {
        totalSealed: {
          previous: prevSealed,
          changePercent: pct(totalSealed, prevSealed),
        },
        avgProcessingDays: {
          previous: prevAvg,
          changePercent: pct(avgProcessingDays, prevAvg),
        },
        rejectionRate: {
          previous: prevRejRate,
          changePercent: pct(rejectionRate, prevRejRate),
        },
      };
    }

    return {
      totalSealed,
      avgProcessingDays,
      officesCovered,
      totalOffices,
      formReissueRate,
      rejectionRate,
      comparisons,
    };
  });

  return { success: true, data };
});
```

- [ ] **Step 2: Verify endpoint compiles**

Run from `app/`:
```bash
npx nuxi typecheck
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add app/server/api/analytics/declarations/summary.get.ts
git commit -m "feat(analytics): add summary KPI endpoint with Redis caching"
```

---

## Task 6: Charts API Endpoint

**Files:**
- Create: `app/server/api/analytics/declarations/charts.get.ts`

- [ ] **Step 1: Create the charts endpoint**

Create `app/server/api/analytics/declarations/charts.get.ts`:

```typescript
import prisma from "~/server/utils/prisma";
import { getCached, buildCacheKey } from "~/server/utils/analytics-cache";
import {
  parseFilters,
  getRoleScope,
  buildSealedHistoryWhere,
} from "~/server/utils/analytics-filters";

interface TimelinePoint {
  month: string;
  count: number;
  prevCount: number;
}

interface InstitutionEntry {
  name: string;
  count: number;
}

interface CollectionOfficeData {
  byType: { type: string; count: number }[];
  byRegion: { region: string; count: number }[];
}

interface OfficerEntry {
  name: string;
  count: number;
  avgDays: number;
}

interface ChartsData {
  timeline: TimelinePoint[];
  byInstitution: InstitutionEntry[];
  byCollectionOffice: CollectionOfficeData;
  officerPerformance: OfficerEntry[];
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const filters = parseFilters(event);
  const scope = await getRoleScope(event);
  const where = buildSealedHistoryWhere(filters, scope);

  const cacheKey = buildCacheKey("charts", {
    ...filters,
    role: scope.role,
    userId: scope.role === "admin" || scope.role === "legal_unit" ? undefined : scope.userId,
  });

  const data = await getCached<ChartsData>(cacheKey, 300, async () => {
    // 1. Timeline — sealed count per month (last 12 months)
    const timelineRows = await prisma.$queryRaw<
      { bucket: Date; count: bigint }[]
    >`
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', now()) - interval '11 months',
          date_trunc('month', now()),
          interval '1 month'
        ) AS bucket
      )
      SELECT m.bucket, COUNT(dsh.id) AS count
      FROM months m
      LEFT JOIN declaration_status_history dsh
        ON dsh.status = 'SEALED'
        AND date_trunc('month', dsh.created_at) = m.bucket
      GROUP BY m.bucket
      ORDER BY m.bucket ASC
    `;

    const prevTimelineRows = await prisma.$queryRaw<
      { bucket: Date; count: bigint }[]
    >`
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', now()) - interval '23 months',
          date_trunc('month', now()) - interval '12 months',
          interval '1 month'
        ) AS bucket
      )
      SELECT m.bucket, COUNT(dsh.id) AS count
      FROM months m
      LEFT JOIN declaration_status_history dsh
        ON dsh.status = 'SEALED'
        AND date_trunc('month', dsh.created_at) = m.bucket
      GROUP BY m.bucket
      ORDER BY m.bucket ASC
    `;

    const timeline: TimelinePoint[] = timelineRows.map((row, i) => ({
      month: row.bucket.toISOString().slice(0, 7),
      count: Number(row.count),
      prevCount: Number(prevTimelineRows[i]?.count ?? 0),
    }));

    // 2. By Institution — top 10
    const sealedDeclIds = await prisma.declarationStatusHistory.findMany({
      where,
      select: { declarationId: true },
      distinct: ["declarationId"],
    });
    const declIds = sealedDeclIds.map((d) => d.declarationId);

    let byInstitution: InstitutionEntry[] = [];
    if (declIds.length > 0) {
      const instGroups = await prisma.applicantOffice.groupBy({
        by: ["institutionId"],
        where: {
          profile: { declarations: { some: { id: { in: declIds } } } },
          institutionId: { not: null },
        },
        _count: { institutionId: true },
        orderBy: { _count: { institutionId: "desc" } },
        take: 10,
      });

      const instIds = instGroups
        .map((g) => g.institutionId)
        .filter((id): id is string => id !== null);
      const institutions = await prisma.institution.findMany({
        where: { id: { in: instIds } },
        select: { id: true, name: true },
      });
      const nameMap = new Map(institutions.map((i) => [i.id, i.name]));

      byInstitution = instGroups.map((g) => ({
        name: nameMap.get(g.institutionId!) || "Unknown",
        count: g._count.institutionId,
      }));
    }

    // 3. By Collection Office
    let byCollectionOffice: CollectionOfficeData = {
      byType: [],
      byRegion: [],
    };
    if (declIds.length > 0) {
      const collections = await prisma.formCollection.findMany({
        where: { declarationId: { in: declIds } },
        select: {
          collectionOffice: {
            select: { type: true, region: true },
          },
        },
      });

      const typeCounts = new Map<string, number>();
      const regionCounts = new Map<string, number>();

      for (const c of collections) {
        const t = c.collectionOffice.type;
        typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
        const r = c.collectionOffice.region ?? "Headquarters";
        regionCounts.set(r, (regionCounts.get(r) ?? 0) + 1);
      }

      byCollectionOffice = {
        byType: Array.from(typeCounts.entries())
          .map(([type, count]) => ({ type, count }))
          .sort((a, b) => b.count - a.count),
        byRegion: Array.from(regionCounts.entries())
          .map(([region, count]) => ({ region, count }))
          .sort((a, b) => b.count - a.count),
      };
    }

    // 4. Officer Performance — top 10 by count with avg days
    const officerRows = await prisma.$queryRaw<
      { user_id: string; email: string; count: bigint; avg_days: number }[]
    >`
      SELECT
        u.id AS user_id,
        u.email,
        COUNT(sealed.id) AS count,
        COALESCE(AVG(
          EXTRACT(EPOCH FROM (sealed.created_at - created_entry.created_at)) / 86400.0
        ), 0) AS avg_days
      FROM declaration_status_history sealed
      JOIN users u ON sealed.changed_by_id = u.id
      JOIN (
        SELECT declaration_id, MIN(created_at) AS created_at
        FROM declaration_status_history
        WHERE status = 'CODE_GENERATED'
        GROUP BY declaration_id
      ) created_entry ON sealed.declaration_id = created_entry.declaration_id
      WHERE sealed.status = 'SEALED'
        AND sealed.changed_by_id IS NOT NULL
      GROUP BY u.id, u.email
      ORDER BY count DESC
      LIMIT 10
    `;

    const officerPerformance: OfficerEntry[] = officerRows.map((r) => ({
      name: r.email.split("@")[0],
      count: Number(r.count),
      avgDays: Math.round(r.avg_days * 10) / 10,
    }));

    return { timeline, byInstitution, byCollectionOffice, officerPerformance };
  });

  return { success: true, data };
});
```

- [ ] **Step 2: Verify endpoint compiles**

Run from `app/`:
```bash
npx nuxi typecheck
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add app/server/api/analytics/declarations/charts.get.ts
git commit -m "feat(analytics): add charts endpoint with 4 chart data sources"
```

---

## Task 7: List API Endpoint (Live, Paginated)

**Files:**
- Create: `app/server/api/analytics/declarations/list.get.ts`

- [ ] **Step 1: Create the list endpoint**

Create `app/server/api/analytics/declarations/list.get.ts`:

```typescript
import prisma from "~/server/utils/prisma";
import {
  parseFilters,
  getRoleScope,
  buildSealedHistoryWhere,
} from "~/server/utils/analytics-filters";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const filters = parseFilters(event);
  const scope = await getRoleScope(event);
  const where = buildSealedHistoryWhere(filters, scope);

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  const sortableColumns: Record<string, string> = {
    sealedAt: "createdAt",
    code: "declaration.uniqueCode",
    applicant: "declaration.applicant.fullName",
  };
  const orderByField = sortableColumns[filters.sortBy ?? "sealedAt"] ?? "createdAt";
  const orderByDir = filters.sortOrder ?? "desc";

  const [total, rows] = await Promise.all([
    prisma.declarationStatusHistory.count({ where }),
    prisma.declarationStatusHistory.findMany({
      where,
      orderBy: { [orderByField.split(".")[0]]: orderByDir },
      skip,
      take: pageSize,
      select: {
        createdAt: true,
        changedBy: { select: { email: true } },
        declaration: {
          select: {
            id: true,
            uniqueCode: true,
            createdAt: true,
            applicant: {
              select: {
                fullName: true,
                ghanaCardNumber: true,
                offices: {
                  select: {
                    institution: { select: { name: true } },
                  },
                },
              },
            },
            formCollections: {
              take: 1,
              orderBy: { createdAt: "desc" },
              select: {
                collectionOffice: {
                  select: { name: true, region: true },
                },
              },
            },
            returnOffice: { select: { name: true, region: true } },
            receipts: {
              take: 1,
              select: { receiptNumber: true, pdfUrl: true },
            },
          },
        },
      },
    }),
  ]);

  const items = rows.map((row) => {
    const decl = row.declaration;
    const sealedAt = row.createdAt;
    const codeGeneratedAt = decl.createdAt;
    const processingDays =
      Math.round(
        ((sealedAt.getTime() - codeGeneratedAt.getTime()) / 86400000) * 10,
      ) / 10;

    const collectionOffice =
      decl.formCollections[0]?.collectionOffice ?? decl.returnOffice;

    const institutions = decl.applicant.offices
      .map((o) => o.institution?.name)
      .filter((n): n is string => !!n);
    const uniqueInstitutions = [...new Set(institutions)];

    const receipt = decl.receipts[0];

    return {
      id: decl.id,
      uniqueCode: decl.uniqueCode,
      applicantName: decl.applicant.fullName,
      ghanaCardNumber: decl.applicant.ghanaCardNumber,
      institutions: uniqueInstitutions,
      collectionOfficeName: collectionOffice?.name ?? null,
      collectionOfficeRegion: collectionOffice?.region ?? null,
      sealedAt: sealedAt.toISOString(),
      processingDays,
      processedBy: row.changedBy?.email?.split("@")[0] ?? "System",
      receiptNumber: receipt?.receiptNumber ?? null,
      receiptUrl: receipt?.pdfUrl ?? null,
    };
  });

  return {
    success: true,
    data: {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    },
  };
});
```

- [ ] **Step 2: Verify endpoint compiles**

Run from `app/`:
```bash
npx nuxi typecheck
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add app/server/api/analytics/declarations/list.get.ts
git commit -m "feat(analytics): add paginated list endpoint for sealed declarations"
```

---

## Task 8: Export API Endpoint (CSV/PDF)

**Files:**
- Create: `app/server/api/analytics/declarations/export.get.ts`

- [ ] **Step 1: Create the export endpoint**

Create `app/server/api/analytics/declarations/export.get.ts`:

```typescript
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import prisma from "~/server/utils/prisma";
import {
  parseFilters,
  getRoleScope,
  buildSealedHistoryWhere,
} from "~/server/utils/analytics-filters";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  // Export restricted to admin and schedule_officer
  const roles = auth.roles as string[];
  if (!roles.includes("admin") && !roles.includes("schedule_officer")) {
    throw createError({ statusCode: 403, statusMessage: "Export not permitted for this role" });
  }

  const query = getQuery(event);
  const format = (query.format as string) || "csv";

  if (format !== "csv" && format !== "pdf") {
    throw createError({ statusCode: 400, statusMessage: "Format must be csv or pdf" });
  }

  const filters = parseFilters(event);
  const scope = await getRoleScope(event);
  const where = buildSealedHistoryWhere(filters, scope);

  const rows = await prisma.declarationStatusHistory.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      changedBy: { select: { email: true } },
      declaration: {
        select: {
          uniqueCode: true,
          createdAt: true,
          applicant: {
            select: {
              fullName: true,
              ghanaCardNumber: true,
              offices: {
                select: { institution: { select: { name: true } } },
              },
            },
          },
          formCollections: {
            take: 1,
            orderBy: { createdAt: "desc" },
            select: {
              collectionOffice: { select: { name: true, region: true } },
            },
          },
          returnOffice: { select: { name: true, region: true } },
          receipts: { take: 1, select: { receiptNumber: true } },
        },
      },
    },
  });

  const items = rows.map((row) => {
    const decl = row.declaration;
    const office = decl.formCollections[0]?.collectionOffice ?? decl.returnOffice;
    const institutions = [
      ...new Set(
        decl.applicant.offices
          .map((o) => o.institution?.name)
          .filter(Boolean),
      ),
    ].join("; ");
    const days =
      Math.round(
        ((row.createdAt.getTime() - decl.createdAt.getTime()) / 86400000) * 10,
      ) / 10;

    return {
      code: decl.uniqueCode,
      applicant: decl.applicant.fullName,
      ghanaCard: decl.applicant.ghanaCardNumber,
      institutions,
      collectionOffice: office?.name ?? "",
      region: office?.region ?? "",
      sealedAt: row.createdAt.toISOString().slice(0, 10),
      processingDays: days,
      processedBy: row.changedBy?.email?.split("@")[0] ?? "System",
      receipt: decl.receipts[0]?.receiptNumber ?? "",
    };
  });

  if (format === "csv") {
    const headers = [
      "Code",
      "Applicant",
      "Ghana Card",
      "Institutions",
      "Collection Office",
      "Region",
      "Sealed Date",
      "Processing Days",
      "Processed By",
      "Receipt",
    ];
    const csvRows = [
      headers.join(","),
      ...items.map((item) =>
        [
          item.code,
          `"${item.applicant}"`,
          item.ghanaCard,
          `"${item.institutions}"`,
          `"${item.collectionOffice}"`,
          `"${item.region}"`,
          item.sealedAt,
          item.processingDays,
          item.processedBy,
          item.receipt,
        ].join(","),
      ),
    ];

    setResponseHeader(event, "Content-Type", "text/csv");
    setResponseHeader(
      event,
      "Content-Disposition",
      `attachment; filename="sealed-declarations-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    return csvRows.join("\n");
  }

  // PDF generation
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([842, 595]); // A4 landscape
  const { height } = page.getSize();
  let y = height - 40;

  page.drawText("Sealed Declarations Report", {
    x: 40,
    y,
    size: 16,
    font: boldFont,
    color: rgb(0, 0.42, 0.25),
  });
  y -= 20;
  page.drawText(
    `Generated: ${new Date().toISOString().slice(0, 10)} | Total: ${items.length} declarations`,
    { x: 40, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) },
  );
  y -= 25;

  const cols = [
    { label: "Code", x: 40, w: 120 },
    { label: "Applicant", x: 160, w: 120 },
    { label: "Institution(s)", x: 280, w: 140 },
    { label: "Office", x: 420, w: 100 },
    { label: "Sealed", x: 520, w: 70 },
    { label: "Days", x: 590, w: 40 },
    { label: "Officer", x: 630, w: 80 },
    { label: "Receipt", x: 710, w: 90 },
  ];

  for (const col of cols) {
    page.drawText(col.label, {
      x: col.x,
      y,
      size: 8,
      font: boldFont,
      color: rgb(0.3, 0.3, 0.3),
    });
  }
  y -= 4;
  page.drawLine({
    start: { x: 40, y },
    end: { x: 800, y },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  });
  y -= 12;

  for (const item of items) {
    if (y < 40) {
      page = pdfDoc.addPage([842, 595]);
      y = height - 40;
    }

    const values = [
      item.code,
      item.applicant.slice(0, 20),
      item.institutions.slice(0, 25),
      item.collectionOffice.slice(0, 16),
      item.sealedAt,
      String(item.processingDays),
      item.processedBy.slice(0, 12),
      item.receipt,
    ];

    for (let i = 0; i < cols.length; i++) {
      page.drawText(values[i], {
        x: cols[i].x,
        y,
        size: 7,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
    }
    y -= 14;
  }

  const pdfBytes = await pdfDoc.save();

  setResponseHeader(event, "Content-Type", "application/pdf");
  setResponseHeader(
    event,
    "Content-Disposition",
    `attachment; filename="sealed-declarations-${new Date().toISOString().slice(0, 10)}.pdf"`,
  );
  return Buffer.from(pdfBytes);
});
```

- [ ] **Step 2: Verify endpoint compiles**

Run from `app/`:
```bash
npx nuxi typecheck
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add app/server/api/analytics/declarations/export.get.ts
git commit -m "feat(analytics): add CSV and PDF export endpoint"
```

---

## Task 9: useAnalytics Composable

**Files:**
- Create: `app/composables/useAnalytics.ts`

- [ ] **Step 1: Create the composable**

Create `app/composables/useAnalytics.ts`:

```typescript
import { authFetch } from "~/utils/authFetch";

export interface AnalyticsFilterState {
  dateFrom: string;
  dateTo: string;
  officeId: string;
  collectionOfficeId: string;
  officerId: string;
  search: string;
  page: number;
  pageSize: number;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

export interface SummaryData {
  totalSealed: number;
  avgProcessingDays: number;
  officesCovered: number;
  totalOffices: number;
  formReissueRate: number;
  rejectionRate: number;
  comparisons: {
    totalSealed: { previous: number; changePercent: number | null };
    avgProcessingDays: { previous: number; changePercent: number | null };
    rejectionRate: { previous: number; changePercent: number | null };
  };
}

export interface ChartsData {
  timeline: { month: string; count: number; prevCount: number }[];
  byInstitution: { name: string; count: number }[];
  byCollectionOffice: {
    byType: { type: string; count: number }[];
    byRegion: { region: string; count: number }[];
  };
  officerPerformance: { name: string; count: number; avgDays: number }[];
}

export interface ListItem {
  id: string;
  uniqueCode: string;
  applicantName: string;
  ghanaCardNumber: string;
  institutions: string[];
  collectionOfficeName: string | null;
  collectionOfficeRegion: string | null;
  sealedAt: string;
  processingDays: number;
  processedBy: string;
  receiptNumber: string | null;
  receiptUrl: string | null;
}

export interface ListData {
  items: ListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

function buildQueryString(filters: Partial<AnalyticsFilterState>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function useAnalytics() {
  const filters = reactive<AnalyticsFilterState>({
    dateFrom: "",
    dateTo: "",
    officeId: "",
    collectionOfficeId: "",
    officerId: "",
    search: "",
    page: 1,
    pageSize: 25,
    sortBy: "sealedAt",
    sortOrder: "desc",
  });

  const summary = ref<SummaryData | null>(null);
  const charts = ref<ChartsData | null>(null);
  const list = ref<ListData | null>(null);

  const loadingSummary = ref(false);
  const loadingCharts = ref(false);
  const loadingList = ref(false);
  const error = ref<string | null>(null);

  const filterParams = computed(() => ({
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    officeId: filters.officeId,
    collectionOfficeId: filters.collectionOfficeId,
    officerId: filters.officerId,
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
      const res = await authFetch<{ success: boolean; data: SummaryData }>(
        `/api/analytics/declarations/summary${buildQueryString(filterParams.value)}`,
      );
      summary.value = res.data;
    } catch (e) {
      error.value = "Failed to load summary";
      console.error(e);
    } finally {
      loadingSummary.value = false;
    }
  }

  async function fetchCharts() {
    loadingCharts.value = true;
    try {
      const res = await authFetch<{ success: boolean; data: ChartsData }>(
        `/api/analytics/declarations/charts${buildQueryString(filterParams.value)}`,
      );
      charts.value = res.data;
    } catch (e) {
      error.value = "Failed to load charts";
      console.error(e);
    } finally {
      loadingCharts.value = false;
    }
  }

  async function fetchList() {
    loadingList.value = true;
    try {
      const res = await authFetch<{ success: boolean; data: ListData }>(
        `/api/analytics/declarations/list${buildQueryString(listParams.value)}`,
      );
      list.value = res.data;
    } catch (e) {
      error.value = "Failed to load list";
      console.error(e);
    } finally {
      loadingList.value = false;
    }
  }

  async function refreshAll() {
    error.value = null;
    await Promise.all([fetchSummary(), fetchCharts(), fetchList()]);
  }

  function applyFilters() {
    filters.page = 1;
    refreshAll();
  }

  function resetFilters() {
    filters.dateFrom = "";
    filters.dateTo = "";
    filters.officeId = "";
    filters.collectionOfficeId = "";
    filters.officerId = "";
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
      filters.sortOrder = "desc";
    }
    filters.page = 1;
    fetchList();
  }

  function getExportUrl(format: "csv" | "pdf"): string {
    const qs = buildQueryString({ ...filterParams.value, format });
    return `/api/analytics/declarations/export${qs}`;
  }

  onMounted(refreshAll);

  return {
    filters,
    summary,
    charts,
    list,
    loadingSummary,
    loadingCharts,
    loadingList,
    error,
    applyFilters,
    resetFilters,
    refreshAll,
    fetchList,
    setPage,
    setSort,
    getExportUrl,
  };
}
```

- [ ] **Step 2: Verify composable compiles**

Run from `app/`:
```bash
npx nuxi typecheck
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add app/composables/useAnalytics.ts
git commit -m "feat(analytics): add useAnalytics composable with reactive filters"
```

---

## Task 10: FilterBar Component

**Files:**
- Create: `app/components/analytics/FilterBar.vue`

- [ ] **Step 1: Create the FilterBar component**

Create `app/components/analytics/FilterBar.vue`:

```vue
<script setup lang="ts">
import type { AnalyticsFilterState } from "~/composables/useAnalytics";
import { authFetch } from "~/utils/authFetch";

const props = defineProps<{
  filters: AnalyticsFilterState;
  showOfficerFilter?: boolean;
}>();

const emit = defineEmits<{
  apply: [];
  reset: [];
  export: [format: "csv" | "pdf"];
}>();

interface SelectOption {
  id: string;
  name: string;
}

const institutions = ref<SelectOption[]>([]);
const collectionOffices = ref<SelectOption[]>([]);
const officers = ref<SelectOption[]>([]);

onMounted(async () => {
  try {
    const [instRes, officeRes] = await Promise.all([
      authFetch<{ success: boolean; data: SelectOption[] }>("/api/institutions"),
      authFetch<{ success: boolean; data: SelectOption[] }>("/api/categories"),
    ]);

    if (Array.isArray(instRes)) {
      institutions.value = instRes as unknown as SelectOption[];
    } else if (instRes.data) {
      institutions.value = instRes.data;
    }
  } catch {
    // Filter dropdowns degrade gracefully
  }
});

type PresetKey = "today" | "week" | "month" | "quarter" | "year" | "all";

const activePreset = ref<PresetKey>("all");

function applyPreset(preset: PresetKey) {
  activePreset.value = preset;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  switch (preset) {
    case "today":
      props.filters.dateFrom = today;
      props.filters.dateTo = today;
      break;
    case "week": {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      props.filters.dateFrom = weekStart.toISOString().slice(0, 10);
      props.filters.dateTo = today;
      break;
    }
    case "month": {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      props.filters.dateFrom = monthStart.toISOString().slice(0, 10);
      props.filters.dateTo = today;
      break;
    }
    case "quarter": {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      const quarterStart = new Date(now.getFullYear(), qMonth, 1);
      props.filters.dateFrom = quarterStart.toISOString().slice(0, 10);
      props.filters.dateTo = today;
      break;
    }
    case "year": {
      const yearStart = new Date(now.getFullYear(), 0, 1);
      props.filters.dateFrom = yearStart.toISOString().slice(0, 10);
      props.filters.dateTo = today;
      break;
    }
    case "all":
      props.filters.dateFrom = "";
      props.filters.dateTo = "";
      break;
  }
  emit("apply");
}

const presets: { key: PresetKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "quarter", label: "This Quarter" },
  { key: "year", label: "This Year" },
  { key: "all", label: "All Time" },
];

function handleSearch() {
  emit("apply");
}

function handleReset() {
  activePreset.value = "all";
  emit("reset");
}
</script>

<template>
  <Card>
    <CardContent class="p-4">
      <div class="flex flex-wrap items-center gap-3">
        <!-- Date Presets -->
        <div class="flex gap-1">
          <button
            v-for="preset in presets"
            :key="preset.key"
            class="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
            :class="activePreset === preset.key
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'"
            @click="applyPreset(preset.key)"
          >
            {{ preset.label }}
          </button>
        </div>

        <!-- Custom Date Range -->
        <div class="flex items-center gap-2">
          <Input
            v-model="filters.dateFrom"
            type="date"
            class="h-8 w-36 text-xs"
            placeholder="From"
            @change="emit('apply')"
          />
          <span class="text-xs text-muted-foreground">to</span>
          <Input
            v-model="filters.dateTo"
            type="date"
            class="h-8 w-36 text-xs"
            placeholder="To"
            @change="emit('apply')"
          />
        </div>

        <!-- Institution Filter -->
        <select
          v-model="filters.officeId"
          class="h-8 rounded-md border bg-background px-3 text-xs"
          @change="emit('apply')"
        >
          <option value="">All Institutions</option>
          <option
            v-for="inst in institutions"
            :key="inst.id"
            :value="inst.id"
          >
            {{ inst.name }}
          </option>
        </select>

        <!-- Search -->
        <div class="flex-1 min-w-[200px]">
          <Input
            v-model="filters.search"
            placeholder="Search by code, name, or Ghana Card..."
            class="h-8 text-xs"
            @keyup.enter="handleSearch"
          />
        </div>

        <!-- Actions -->
        <div class="flex gap-2">
          <Button size="sm" variant="outline" class="h-8 text-xs" @click="handleReset">
            Reset
          </Button>
          <Button
            size="sm"
            class="h-8 text-xs bg-primary"
            @click="$emit('export', 'csv')"
          >
            CSV
          </Button>
          <Button
            size="sm"
            class="h-8 text-xs bg-destructive"
            @click="$emit('export', 'pdf')"
          >
            PDF
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
```

- [ ] **Step 2: Verify component compiles**

Run from `app/`:
```bash
npx nuxi typecheck
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add app/components/analytics/FilterBar.vue
git commit -m "feat(analytics): add FilterBar component with date presets and search"
```

---

## Task 11: KpiCards Component

**Files:**
- Create: `app/components/analytics/KpiCards.vue`

- [ ] **Step 1: Create the KpiCards component**

Create `app/components/analytics/KpiCards.vue`:

```vue
<script setup lang="ts">
import type { SummaryData } from "~/composables/useAnalytics";

function formatChange(val: number | null): string {
  if (val === null) return "";
  return val > 0 ? `↑ ${val}%` : val < 0 ? `↓ ${Math.abs(val)}%` : "0%";
}

function changeClass(val: number | null, invertGood = false): string {
  if (val === null) return "text-muted-foreground";
  const isGood = invertGood ? val < 0 : val > 0;
  return isGood ? "text-green-600" : val === 0 ? "text-muted-foreground" : "text-red-600";
}

const props = defineProps<{
  data: SummaryData | null;
  loading: boolean;
}>();

const cards = computed(() => {
  const d = props.data;
  return [
    {
      label: "Total Sealed",
      value: d?.totalSealed.toLocaleString() ?? "—",
      change: d?.comparisons.totalSealed.changePercent ?? null,
      borderColor: "border-l-primary",
      invertGood: false,
    },
    {
      label: "Avg Processing Time",
      value: d ? `${d.avgProcessingDays} days` : "—",
      change: d?.comparisons.avgProcessingDays.changePercent ?? null,
      borderColor: "border-l-sky-500",
      invertGood: true,
    },
    {
      label: "Offices Covered",
      value: d ? `${d.officesCovered}` : "—",
      footnote: d ? `of ${d.totalOffices} total` : "",
      borderColor: "border-l-yellow-500",
      invertGood: false,
    },
    {
      label: "Form Reissue Rate",
      value: d ? `${d.formReissueRate}%` : "—",
      borderColor: "border-l-purple-500",
      invertGood: false,
    },
    {
      label: "Rejection Rate",
      value: d ? `${d.rejectionRate}%` : "—",
      change: d?.comparisons.rejectionRate.changePercent ?? null,
      borderColor: "border-l-destructive",
      invertGood: true,
    },
  ];
});
</script>

<template>
  <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
    <Card
      v-for="(card, i) in cards"
      :key="i"
      class="border-l-4"
      :class="card.borderColor"
    >
      <CardContent class="p-4">
        <Skeleton v-if="loading" class="h-4 w-20 mb-2" />
        <Skeleton v-if="loading" class="h-8 w-16" />
        <template v-else>
          <p class="text-xs text-muted-foreground uppercase tracking-wide">
            {{ card.label }}
          </p>
          <p class="text-2xl font-extrabold mt-1">{{ card.value }}</p>
          <p
            v-if="card.change !== undefined && card.change !== null"
            class="text-xs mt-1"
            :class="changeClass(card.change, card.invertGood)"
          >
            {{ formatChange(card.change) }} vs prev period
          </p>
          <p
            v-else-if="card.footnote"
            class="text-xs text-muted-foreground mt-1"
          >
            {{ card.footnote }}
          </p>
        </template>
      </CardContent>
    </Card>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add app/components/analytics/KpiCards.vue
git commit -m "feat(analytics): add KpiCards component with trend indicators"
```

---

## Task 12: Chart Components (4 Charts)

**Files:**
- Create: `app/components/analytics/SealedTimelineChart.vue`
- Create: `app/components/analytics/InstitutionChart.vue`
- Create: `app/components/analytics/CollectionOfficeChart.vue`
- Create: `app/components/analytics/OfficerPerformanceChart.vue`

- [ ] **Step 1: Create SealedTimelineChart**

Create `app/components/analytics/SealedTimelineChart.vue`:

```vue
<script setup lang="ts">
import type { ChartsData } from "~/composables/useAnalytics";

const props = defineProps<{
  data: ChartsData["timeline"] | undefined;
  loading: boolean;
}>();

const series = computed(() => {
  if (!props.data) return [];
  return [
    { name: "Current Period", data: props.data.map((d) => d.count) },
    { name: "Previous Period", data: props.data.map((d) => d.prevCount) },
  ];
});

const options = computed(() => ({
  xaxis: {
    categories: props.data?.map((d) => d.month) ?? [],
  },
}));
</script>

<template>
  <AppChartCard
    title="Sealed Declarations Over Time"
    description="Monthly sealed count with previous period comparison"
    type="area"
    :series="series"
    :options="options"
    :loading="loading"
    :height="280"
  />
</template>
```

- [ ] **Step 2: Create InstitutionChart**

Create `app/components/analytics/InstitutionChart.vue`:

```vue
<script setup lang="ts">
import type { ChartsData } from "~/composables/useAnalytics";

const props = defineProps<{
  data: ChartsData["byInstitution"] | undefined;
  loading: boolean;
}>();

const series = computed(() => {
  if (!props.data) return [];
  return [{ name: "Declarations", data: props.data.map((d) => d.count) }];
});

const options = computed(() => ({
  plotOptions: { bar: { horizontal: true, barHeight: "60%" } },
  xaxis: {
    categories: props.data?.map((d) =>
      d.name.length > 25 ? d.name.slice(0, 22) + "…" : d.name,
    ) ?? [],
  },
}));
</script>

<template>
  <AppChartCard
    title="By Institution / Office"
    description="Top 10 institutions by sealed declarations"
    type="bar"
    :series="series"
    :options="options"
    :loading="loading"
    :height="280"
  />
</template>
```

- [ ] **Step 3: Create CollectionOfficeChart**

Create `app/components/analytics/CollectionOfficeChart.vue`:

```vue
<script setup lang="ts">
import type { ChartsData } from "~/composables/useAnalytics";

const props = defineProps<{
  data: ChartsData["byCollectionOffice"] | undefined;
  loading: boolean;
}>();

const donutSeries = computed(() =>
  props.data?.byType.map((d) => d.count) ?? [],
);

const donutOptions = computed(() => ({
  labels: props.data?.byType.map((d) => d.type) ?? [],
  legend: { position: "bottom" as const },
}));

const barSeries = computed(() => {
  if (!props.data?.byRegion.length) return [];
  return [{ name: "Declarations", data: props.data.byRegion.map((d) => d.count) }];
});

const barOptions = computed(() => ({
  plotOptions: { bar: { horizontal: false, columnWidth: "55%" } },
  xaxis: {
    categories: props.data?.byRegion.map((d) => d.region) ?? [],
    labels: { rotate: -45, style: { fontSize: "10px" } },
  },
}));
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">By Collection Office</CardTitle>
      <CardDescription>HQ vs Regional split and breakdown by region</CardDescription>
    </CardHeader>
    <CardContent>
      <Skeleton v-if="loading" class="w-full h-[280px]" />
      <div v-else class="grid grid-cols-2 gap-4">
        <ClientOnly>
          <apexchart
            type="donut"
            :series="donutSeries"
            :options="donutOptions"
            :height="240"
          />
          <template #fallback>
            <Skeleton class="w-full h-[240px]" />
          </template>
        </ClientOnly>
        <ClientOnly>
          <apexchart
            v-if="barSeries.length > 0"
            type="bar"
            :series="barSeries"
            :options="barOptions"
            :height="240"
          />
          <div v-else class="flex items-center justify-center h-[240px] text-muted-foreground text-sm">
            No regional data
          </div>
          <template #fallback>
            <Skeleton class="w-full h-[240px]" />
          </template>
        </ClientOnly>
      </div>
    </CardContent>
  </Card>
</template>
```

- [ ] **Step 4: Create OfficerPerformanceChart**

Create `app/components/analytics/OfficerPerformanceChart.vue`:

```vue
<script setup lang="ts">
import type { ChartsData } from "~/composables/useAnalytics";

const props = defineProps<{
  data: ChartsData["officerPerformance"] | undefined;
  loading: boolean;
}>();

const series = computed(() => {
  if (!props.data) return [];
  return [
    { name: "Declarations Processed", type: "column", data: props.data.map((d) => d.count) },
    { name: "Avg Days", type: "line", data: props.data.map((d) => d.avgDays) },
  ];
});

const options = computed(() => ({
  chart: { type: "line" as const },
  plotOptions: { bar: { columnWidth: "45%" } },
  stroke: { width: [0, 3] },
  xaxis: {
    categories: props.data?.map((d) => d.name) ?? [],
  },
  yaxis: [
    { title: { text: "Count" } },
    { opposite: true, title: { text: "Avg Days" } },
  ],
}));
</script>

<template>
  <AppChartCard
    title="Officer Performance"
    description="Top 10 officers by declarations processed and avg processing time"
    type="line"
    :series="series"
    :options="options"
    :loading="loading"
    :height="280"
  />
</template>
```

- [ ] **Step 5: Commit**

```bash
git add app/components/analytics/SealedTimelineChart.vue app/components/analytics/InstitutionChart.vue app/components/analytics/CollectionOfficeChart.vue app/components/analytics/OfficerPerformanceChart.vue
git commit -m "feat(analytics): add 4 chart components (timeline, institution, office, officer)"
```

---

## Task 13: DeclarationsTable Component

**Files:**
- Create: `app/components/analytics/DeclarationsTable.vue`

- [ ] **Step 1: Create the DeclarationsTable component**

Create `app/components/analytics/DeclarationsTable.vue`:

```vue
<script setup lang="ts">
import type { ListData } from "~/composables/useAnalytics";

defineProps<{
  data: ListData | null;
  loading: boolean;
  sortBy: string;
  sortOrder: "asc" | "desc";
}>();

const emit = defineEmits<{
  sort: [column: string];
  page: [page: number];
}>();

const columns = [
  { key: "code", label: "Code", sortable: true },
  { key: "applicant", label: "Applicant", sortable: true },
  { key: "institutions", label: "Institution(s)", sortable: false },
  { key: "collectionOffice", label: "Collection Office", sortable: false },
  { key: "sealedAt", label: "Sealed Date", sortable: true },
  { key: "processingDays", label: "Days", sortable: false },
  { key: "processedBy", label: "Processed By", sortable: false },
  { key: "receipt", label: "Receipt", sortable: false },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
</script>

<template>
  <Card>
    <CardHeader class="flex flex-row items-center justify-between">
      <div>
        <CardTitle class="text-base">Sealed Declarations</CardTitle>
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
                @click="col.sortable ? emit('sort', col.key) : undefined"
              >
                {{ col.label }}
                <span v-if="col.sortable && sortBy === col.key" class="ml-1">
                  {{ sortOrder === 'asc' ? '↑' : '↓' }}
                </span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="item in data.items"
              :key="item.id"
              class="cursor-pointer hover:bg-muted/50"
            >
              <TableCell>
                <NuxtLink
                  :to="`/applicant/declaration/${item.id}`"
                  class="font-mono text-xs text-primary hover:underline"
                >
                  {{ item.uniqueCode }}
                </NuxtLink>
              </TableCell>
              <TableCell>{{ item.applicantName }}</TableCell>
              <TableCell class="max-w-[200px] truncate" :title="item.institutions.join(', ')">
                {{ item.institutions.join(", ") || "—" }}
              </TableCell>
              <TableCell>{{ item.collectionOfficeName ?? "—" }}</TableCell>
              <TableCell>{{ formatDate(item.sealedAt) }}</TableCell>
              <TableCell>{{ item.processingDays }}</TableCell>
              <TableCell>{{ item.processedBy }}</TableCell>
              <TableCell>
                <span v-if="item.receiptNumber" class="text-primary text-xs">
                  ✓ {{ item.receiptNumber }}
                </span>
                <span v-else class="text-muted-foreground text-xs">—</span>
              </TableCell>
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
        No sealed declarations found matching the current filters.
      </div>
    </CardContent>
  </Card>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add app/components/analytics/DeclarationsTable.vue
git commit -m "feat(analytics): add DeclarationsTable component with pagination and sorting"
```

---

## Task 14: Admin Analytics Page

**Files:**
- Create: `app/pages/admin/analytics.vue`

- [ ] **Step 1: Create the admin analytics page**

Create `app/pages/admin/analytics.vue`:

```vue
<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";

definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const authStore = useAuthStore();
const {
  filters,
  summary,
  charts,
  list,
  loadingSummary,
  loadingCharts,
  loadingList,
  applyFilters,
  resetFilters,
  setPage,
  setSort,
  getExportUrl,
} = useAnalytics();

function handleExport(format: "csv" | "pdf") {
  const url = getExportUrl(format);
  const token = authStore.accessToken;
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", "");
  // For auth, open in new tab — the browser cookie/token will handle auth
  window.open(`${url}&_token=${token}`, "_blank");
}
</script>

<template>
  <div class="space-y-6">
    <AppPageHeader
      title="Sealed Declarations Analytics"
      description="Comprehensive view of all completed and sealed declarations"
    />

    <!-- Zone 1: Filters -->
    <AnalyticsFilterBar
      :filters="filters"
      :show-officer-filter="true"
      @apply="applyFilters"
      @reset="resetFilters"
      @export="handleExport"
    />

    <!-- Zone 2: KPIs -->
    <AnalyticsKpiCards :data="summary" :loading="loadingSummary" />

    <!-- Zone 3: Charts -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <AnalyticsSealedTimelineChart
        :data="charts?.timeline"
        :loading="loadingCharts"
      />
      <AnalyticsInstitutionChart
        :data="charts?.byInstitution"
        :loading="loadingCharts"
      />
      <AnalyticsCollectionOfficeChart
        :data="charts?.byCollectionOffice"
        :loading="loadingCharts"
      />
      <AnalyticsOfficerPerformanceChart
        :data="charts?.officerPerformance"
        :loading="loadingCharts"
      />
    </div>

    <!-- Zone 4: Detail Table -->
    <AnalyticsDeclarationsTable
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

- [ ] **Step 2: Create officer, legal, and applicant analytics pages**

Create `app/pages/officer/analytics.vue`:

```vue
<script setup lang="ts">
definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const {
  filters,
  summary,
  charts,
  list,
  loadingSummary,
  loadingCharts,
  loadingList,
  applyFilters,
  resetFilters,
  setPage,
  setSort,
} = useAnalytics();
</script>

<template>
  <div class="space-y-6">
    <AppPageHeader
      title="My Sealed Declarations"
      description="Declarations you have processed and sealed"
    />

    <AnalyticsFilterBar
      :filters="filters"
      :show-officer-filter="false"
      @apply="applyFilters"
      @reset="resetFilters"
    />

    <AnalyticsKpiCards :data="summary" :loading="loadingSummary" />

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <AnalyticsSealedTimelineChart :data="charts?.timeline" :loading="loadingCharts" />
      <AnalyticsInstitutionChart :data="charts?.byInstitution" :loading="loadingCharts" />
      <AnalyticsCollectionOfficeChart :data="charts?.byCollectionOffice" :loading="loadingCharts" />
    </div>

    <AnalyticsDeclarationsTable
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

Create `app/pages/legal/analytics.vue`:

```vue
<script setup lang="ts">
definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const {
  filters,
  summary,
  charts,
  list,
  loadingSummary,
  loadingCharts,
  loadingList,
  applyFilters,
  resetFilters,
  setPage,
  setSort,
} = useAnalytics();
</script>

<template>
  <div class="space-y-6">
    <AppPageHeader
      title="Sealed Declarations"
      description="All completed and sealed declarations for verification reference"
    />

    <AnalyticsFilterBar
      :filters="filters"
      :show-officer-filter="false"
      @apply="applyFilters"
      @reset="resetFilters"
    />

    <AnalyticsKpiCards :data="summary" :loading="loadingSummary" />

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <AnalyticsSealedTimelineChart :data="charts?.timeline" :loading="loadingCharts" />
      <AnalyticsInstitutionChart :data="charts?.byInstitution" :loading="loadingCharts" />
    </div>

    <AnalyticsDeclarationsTable
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

Create `app/pages/applicant/analytics.vue`:

```vue
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
} = useAnalytics();
</script>

<template>
  <div class="space-y-6">
    <AppPageHeader
      title="My Completed Declarations"
      description="Your sealed and completed asset declarations"
    />

    <AnalyticsFilterBar
      :filters="filters"
      :show-officer-filter="false"
      @apply="applyFilters"
      @reset="resetFilters"
    />

    <AnalyticsKpiCards :data="summary" :loading="loadingSummary" />

    <AnalyticsDeclarationsTable
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
git add app/pages/admin/analytics.vue app/pages/officer/analytics.vue app/pages/legal/analytics.vue app/pages/applicant/analytics.vue
git commit -m "feat(analytics): add analytics pages for all 4 roles"
```

---

## Task 15: SealedSummaryWidget and Dashboard Integration

**Files:**
- Create: `app/components/analytics/SealedSummaryWidget.vue`
- Modify: `app/layouts/dashboard.vue`
- Modify: `app/pages/admin/dashboard.vue`
- Modify: `app/pages/officer/dashboard.vue`
- Modify: `app/pages/legal/dashboard.vue`
- Modify: `app/pages/applicant/dashboard.vue`

- [ ] **Step 1: Create SealedSummaryWidget**

Create `app/components/analytics/SealedSummaryWidget.vue`:

```vue
<script setup lang="ts">
import { authFetch } from "~/utils/authFetch";

const props = defineProps<{
  role: "admin" | "officer" | "legal" | "applicant";
}>();

interface WidgetData {
  totalSealed: number;
  avgProcessingDays: number;
  thisWeek: number;
}

const data = ref<WidgetData | null>(null);
const loading = ref(true);

onMounted(async () => {
  try {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekFrom = weekStart.toISOString().slice(0, 10);

    const [summaryRes, weekRes] = await Promise.all([
      authFetch<{ success: boolean; data: { totalSealed: number; avgProcessingDays: number } }>(
        "/api/analytics/declarations/summary",
      ),
      authFetch<{ success: boolean; data: { totalSealed: number } }>(
        `/api/analytics/declarations/summary?dateFrom=${weekFrom}`,
      ),
    ]);

    data.value = {
      totalSealed: summaryRes.data.totalSealed,
      avgProcessingDays: summaryRes.data.avgProcessingDays,
      thisWeek: weekRes.data.totalSealed,
    };
  } catch (e) {
    console.error("Failed to load sealed summary:", e);
  } finally {
    loading.value = false;
  }
});

const analyticsHref = computed(() => {
  const routes: Record<string, string> = {
    admin: "/admin/analytics",
    officer: "/officer/analytics",
    legal: "/legal/analytics",
    applicant: "/applicant/analytics",
  };
  return routes[props.role];
});

const labels = computed(() => {
  if (props.role === "officer") {
    return { total: "I Processed", avg: "My Avg Time", week: "This Week", link: "View Details →" };
  }
  if (props.role === "applicant") {
    return { total: "My Sealed", avg: "Avg Time", week: "This Week", link: "View All →" };
  }
  return { total: "Total Sealed", avg: "Avg Time", week: "This Week", link: "View Full Analytics →" };
});
</script>

<template>
  <Card>
    <CardContent class="p-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-semibold text-sm">Sealed Declarations</h3>
        <NuxtLink :to="analyticsHref" class="text-xs text-primary hover:underline">
          {{ labels.link }}
        </NuxtLink>
      </div>

      <div v-if="loading" class="grid grid-cols-3 gap-3">
        <Skeleton class="h-16" />
        <Skeleton class="h-16" />
        <Skeleton class="h-16" />
      </div>
      <div v-else-if="data" class="grid grid-cols-3 gap-3">
        <div class="text-center p-2 bg-primary/5 rounded-lg">
          <p class="text-xl font-extrabold text-primary">{{ data.totalSealed.toLocaleString() }}</p>
          <p class="text-[10px] text-muted-foreground">{{ labels.total }}</p>
        </div>
        <div class="text-center p-2 bg-sky-500/5 rounded-lg">
          <p class="text-xl font-extrabold text-sky-600">{{ data.avgProcessingDays }}d</p>
          <p class="text-[10px] text-muted-foreground">{{ labels.avg }}</p>
        </div>
        <div class="text-center p-2 bg-yellow-500/5 rounded-lg">
          <p class="text-xl font-extrabold text-yellow-700">{{ data.thisWeek }}</p>
          <p class="text-[10px] text-muted-foreground">{{ labels.week }}</p>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
```

- [ ] **Step 2: Add Analytics nav link to dashboard layout**

In `app/layouts/dashboard.vue`, add an "Analytics" nav item to each role's navigation array.

For the applicant section (after the "New Declaration" item around line 38):

```typescript
      { name: "Analytics", href: "/applicant/analytics", icon: "bar-chart" },
```

For the officer section (after the "Receipts" item around line 48):

```typescript
      { name: "Analytics", href: "/officer/analytics", icon: "bar-chart" },
```

For the legal section (after the "Verify Code" item around line 56):

```typescript
      { name: "Analytics", href: "/legal/analytics", icon: "bar-chart" },
```

For the admin section (after the "Reports" item around line 68):

```typescript
      { name: "Analytics", href: "/admin/analytics", icon: "bar-chart" },
```

- [ ] **Step 3: Add SealedSummaryWidget to admin dashboard**

In `app/pages/admin/dashboard.vue`, add the widget in the template. Find a suitable spot (e.g., after the existing stat cards or before the charts section) and add:

```vue
<AnalyticsSealedSummaryWidget role="admin" />
```

- [ ] **Step 4: Add SealedSummaryWidget to officer dashboard**

In `app/pages/officer/dashboard.vue`, add:

```vue
<AnalyticsSealedSummaryWidget role="officer" />
```

- [ ] **Step 5: Add SealedSummaryWidget to legal dashboard**

In `app/pages/legal/dashboard.vue`, add:

```vue
<AnalyticsSealedSummaryWidget role="legal" />
```

- [ ] **Step 6: Add SealedSummaryWidget to applicant dashboard**

In `app/pages/applicant/dashboard.vue`, add:

```vue
<AnalyticsSealedSummaryWidget role="applicant" />
```

- [ ] **Step 7: Verify everything compiles**

Run from `app/`:
```bash
npx nuxi typecheck
```
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add app/components/analytics/SealedSummaryWidget.vue app/layouts/dashboard.vue app/pages/admin/dashboard.vue app/pages/officer/dashboard.vue app/pages/legal/dashboard.vue app/pages/applicant/dashboard.vue
git commit -m "feat(analytics): add summary widget and analytics nav to all dashboards"
```

---

## Task 16: End-to-End Smoke Test

- [ ] **Step 1: Start the dev stack**

From the repo root:
```bash
docker compose -f docker-compose.dev.yml up -d
```
Wait for all services to be healthy (Postgres, Redis, MinIO, MailHog, app).

- [ ] **Step 2: Run migrations**

From `app/`:
```bash
npx prisma migrate dev
```

- [ ] **Step 3: Verify Redis connection**

From `app/`, open the Nuxt dev server and hit the summary endpoint:
```bash
curl -s http://localhost:3000/api/analytics/declarations/summary \
  -H "Authorization: Bearer <admin-token>" | jq .
```
Expected: `{ success: true, data: { totalSealed: <number>, ... } }`

- [ ] **Step 4: Test each analytics page in the browser**

1. Log in as admin → navigate to `/admin/analytics` → verify all 4 zones render
2. Log in as officer → navigate to `/officer/analytics` → verify scoped data
3. Log in as legal → navigate to `/legal/analytics` → verify read-only view
4. Log in as applicant → navigate to `/applicant/analytics` → verify own data only
5. Test filter presets (Today, This Week, etc.) → verify data changes
6. Test search → type a code or name → verify table filters
7. Test CSV export → click CSV button → verify file downloads
8. Test PDF export → click PDF button → verify file downloads
9. Verify summary widgets appear on each role's existing dashboard

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(analytics): smoke test fixes"
```
