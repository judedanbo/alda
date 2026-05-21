# Dashboard DataTable Enhancement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable `AppDataTable` component with rich visual styling (colored left borders, avatars, dot badges) backed by a `useDataTable` composable, and apply it to the 4 dashboard tabs plus the `/admin/users` and `/admin/audit-logs` pages.

**Architecture:** A `useDataTable` composable manages pagination (limit/offset), sorting, search, and filters via `authFetch`. The `AppDataTable.vue` component wraps shadcn-vue `Table` primitives with Option B styling (status-colored left borders, striped rows, hover highlights, built-in pagination). Four small helper components (`UserCell`, `DateCell`, `CodeBadge`, `VerificationDots`) render rich cell content across tables.

**Tech Stack:** Nuxt 4, shadcn-vue (reka-nova), Tailwind CSS v4, Prisma/Postgres, `authFetch` for authenticated API calls.

**Spec:** `docs/superpowers/specs/2026-05-21-dashboard-datatable-design.md`

---

## File Map

### New files
| File | Purpose |
|------|---------|
| `app/composables/useDataTable.ts` | Composable: pagination, sort, search, filter state + `authFetch` data fetching |
| `app/components/app/UserCell.vue` | Avatar initials + name + optional email |
| `app/components/app/DateCell.vue` | Formatted date + optional relative time |
| `app/components/app/CodeBadge.vue` | Monospace code in status-tinted pill |
| `app/components/app/VerificationDots.vue` | Filled/empty dot visualization |
| `app/utils/statusBorderColors.ts` | Maps status values → Tailwind border-color classes |

### Modified files
| File | What changes |
|------|-------------|
| `app/components/app/DataTable.vue` | Replace with full-featured version: sorting, pagination, status borders, striped/hoverable rows |
| `app/pages/admin/dashboard.vue` | Refactor lines 286–450 (tabbed tables) to use `AppDataTable` + helper components |
| `app/pages/admin/users.vue` | Replace manual table/pagination with `AppDataTable` + `useDataTable` |
| `app/pages/admin/audit-logs.vue` | Replace manual table/pagination with `AppDataTable` + `useDataTable` |

---

## Important: API Response Format

All existing admin endpoints return this shape:
```typescript
{
  success: true,
  data: {
    [itemsKey]: T[],  // "users", "logs", "declarations"
    total: number,
    limit: number,
    offset: number,
  }
}
```

The composable uses `limit`/`offset` (not `page`/`perPage`) in API calls, but exposes page-based state to the component. Conversion: `offset = (page - 1) * perPage`, `lastPage = Math.ceil(total / perPage)`.

The existing dashboard stats endpoint (`/api/admin/stats`) returns recent items as flat arrays (no pagination). The dashboard tables will use the existing paginated endpoints (`/api/admin/users`, `/api/admin/declarations`, `/api/admin/audit-logs`) directly with `limit=5`, rather than the stats endpoint.

For "Recent Codes" there is no separate paginated `/api/admin/codes` endpoint — codes are declarations with extra fields. The dashboard will use `/api/admin/declarations` for this tab (the stats endpoint already maps them identically). If the codes tab needs `verificationCount` or `isRegenerated` fields that `/api/admin/declarations` doesn't return, those columns can be dropped or the stats endpoint data can be used as a fallback.

---

### Task 1: Status Border Color Utility

**Files:**
- Create: `app/utils/statusBorderColors.ts`

- [ ] **Step 1: Create the utility**

This maps status strings to Tailwind border-left color classes. It reuses the existing color scheme from `statusStyles.ts`.

```typescript
// app/utils/statusBorderColors.ts

const STATUS_BORDER: Record<string, string> = {
  // Declaration statuses
  CODE_GENERATED: "border-l-amber-400 dark:border-l-amber-500",
  FORM_COLLECTED: "border-l-cyan-400 dark:border-l-cyan-500",
  SUBMITTED: "border-l-blue-400 dark:border-l-blue-500",
  UNDER_REVIEW: "border-l-purple-400 dark:border-l-purple-500",
  APPROVED: "border-l-green-500 dark:border-l-green-400",
  REJECTED: "border-l-red-500 dark:border-l-red-400",
  SEALED: "border-l-emerald-500 dark:border-l-emerald-400",

  // User statuses (string form)
  active: "border-l-green-500 dark:border-l-green-400",
  inactive: "border-l-red-400 dark:border-l-red-500",

  // Boolean statuses (isActive coerced to string)
  true: "border-l-green-500 dark:border-l-green-400",
  false: "border-l-red-400 dark:border-l-red-500",

  // Audit actions
  LOGIN: "border-l-purple-400 dark:border-l-purple-500",
  LOGOUT: "border-l-gray-400 dark:border-l-gray-500",
  REGISTER: "border-l-green-500 dark:border-l-green-400",
  DECLARATION_CREATE: "border-l-green-500 dark:border-l-green-400",
  DECLARATION_SUBMIT: "border-l-blue-400 dark:border-l-blue-500",
  DECLARATION_APPROVE: "border-l-emerald-500 dark:border-l-emerald-400",
  DECLARATION_REJECT: "border-l-red-500 dark:border-l-red-400",
  USER_UPDATE: "border-l-blue-400 dark:border-l-blue-500",
  ROLE_ASSIGN: "border-l-purple-400 dark:border-l-purple-500",
};

const DEFAULT_BORDER = "border-l-gray-300 dark:border-l-gray-600";

export function getStatusBorderClass(status: string | null | undefined): string {
  if (!status) return DEFAULT_BORDER;
  return STATUS_BORDER[status] ?? DEFAULT_BORDER;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/utils/statusBorderColors.ts
git commit -m "feat: add status-to-border-color mapping utility"
```

---

### Task 2: `useDataTable` Composable

**Files:**
- Create: `app/composables/useDataTable.ts`

- [ ] **Step 1: Create the composable**

```typescript
// app/composables/useDataTable.ts

import { authFetch } from "~/utils/authFetch";

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  lastPage: number;
}

export interface DataTableOptions {
  perPage?: number;
  defaultSort?: string;
  defaultDirection?: "asc" | "desc";
  immediate?: boolean;
  debounce?: number;
  itemsKey?: string;
}

export function useDataTable<T>(endpoint: string, options: DataTableOptions = {}) {
  const {
    perPage = 10,
    defaultSort = null,
    defaultDirection = "desc",
    immediate = true,
    debounce: debounceMs = 300,
    itemsKey,
  } = options;

  const data = ref<T[]>([]) as Ref<T[]>;
  const loading = ref(false);
  const error = ref<unknown>(null);
  const meta = ref<PaginationMeta>({
    page: 1,
    perPage,
    total: 0,
    lastPage: 1,
  });

  const sortColumn = ref<string | null>(defaultSort);
  const sortDirection = ref<"asc" | "desc">(defaultDirection);
  const search = ref("");
  const filters = ref<Record<string, string>>({});

  const hasActiveFilters = computed(
    () => search.value !== "" || Object.values(filters.value).some((v) => v !== ""),
  );

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  async function fetchData(overrides: Record<string, unknown> = {}) {
    loading.value = true;
    error.value = null;

    const page = (overrides.page as number) ?? meta.value.page;
    const limit = meta.value.perPage;
    const offset = (page - 1) * limit;

    const query: Record<string, unknown> = {
      limit,
      offset,
      ...overrides,
    };

    if (sortColumn.value) {
      query.sortBy = sortColumn.value;
      query.sortDir = sortDirection.value;
    }
    if (search.value) {
      query.search = search.value;
    }
    for (const [k, v] of Object.entries(filters.value)) {
      if (v && v !== "all") query[k] = v;
    }

    // Remove internal overrides that aren't API params
    delete query.page;

    try {
      const response = await authFetch<{ success: boolean; data: Record<string, unknown> }>(
        endpoint,
        { query },
      );

      if (response.success) {
        // Auto-detect the items key: use provided key, or find the array in response.data
        let items: T[] = [];
        const d = response.data;

        if (itemsKey && Array.isArray(d[itemsKey])) {
          items = d[itemsKey] as T[];
        } else {
          for (const val of Object.values(d)) {
            if (Array.isArray(val)) {
              items = val as T[];
              break;
            }
          }
        }

        data.value = items;
        const total = (d.total as number) ?? 0;
        meta.value = {
          page,
          perPage: limit,
          total,
          lastPage: Math.max(1, Math.ceil(total / limit)),
        };
      }
    } catch (e) {
      error.value = e;
      console.error(`useDataTable: fetch failed for ${endpoint}`, e);
    } finally {
      loading.value = false;
    }
  }

  function setSort(column: string) {
    if (sortColumn.value === column) {
      sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
    } else {
      sortColumn.value = column;
      sortDirection.value = "desc";
    }
    fetchData({ page: 1 });
  }

  function setPage(page: number) {
    fetchData({ page });
  }

  function setSearch(term: string) {
    search.value = term;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      fetchData({ page: 1 });
    }, debounceMs);
  }

  function setFilter(key: string, value: string) {
    filters.value = { ...filters.value, [key]: value };
    fetchData({ page: 1 });
  }

  function clearFilters() {
    search.value = "";
    filters.value = {};
    fetchData({ page: 1 });
  }

  function refresh() {
    fetchData({ page: meta.value.page });
  }

  if (immediate) {
    onMounted(() => fetchData());
  }

  return {
    data,
    loading,
    error,
    meta,
    sortColumn,
    sortDirection,
    search,
    filters,
    hasActiveFilters,
    fetchData,
    setSort,
    setPage,
    setSearch,
    setFilter,
    clearFilters,
    refresh,
  };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /home/jude/code/alda/app && npx nuxi typecheck 2>&1 | head -30`

Expected: no errors related to `useDataTable`

- [ ] **Step 3: Commit**

```bash
git add app/composables/useDataTable.ts
git commit -m "feat: add useDataTable composable for paginated table state"
```

---

### Task 3: Helper Cell Components

**Files:**
- Create: `app/components/app/UserCell.vue`
- Create: `app/components/app/DateCell.vue`
- Create: `app/components/app/CodeBadge.vue`
- Create: `app/components/app/VerificationDots.vue`

- [ ] **Step 1: Create `UserCell.vue`**

```vue
<!-- app/components/app/UserCell.vue -->
<script setup lang="ts">
const props = defineProps<{
  name: string;
  email?: string;
}>();

const COLORS = ["bg-primary", "bg-blue-600", "bg-purple-600", "bg-amber-600", "bg-cyan-600", "bg-rose-600"];

const initials = computed(() => {
  const parts = props.name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  return props.name.slice(0, 2).toUpperCase();
});

const avatarColor = computed(() => {
  let hash = 0;
  for (const ch of props.name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
});
</script>

<template>
  <div class="flex items-center gap-2.5">
    <div
      :class="[avatarColor, 'w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white shrink-0']"
    >
      {{ initials }}
    </div>
    <div class="min-w-0">
      <p class="text-sm font-medium text-foreground truncate">{{ name }}</p>
      <p v-if="email" class="text-[11px] text-muted-foreground truncate">{{ email }}</p>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Create `DateCell.vue`**

```vue
<!-- app/components/app/DateCell.vue -->
<script setup lang="ts">
const props = defineProps<{
  date: string;
  relative?: boolean;
}>();

const formatted = computed(() =>
  new Date(props.date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }),
);

const relativeText = computed(() => {
  if (!props.relative) return "";
  const now = Date.now();
  const then = new Date(props.date).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return "";
});
</script>

<template>
  <div>
    <p class="text-sm text-muted-foreground">{{ formatted }}</p>
    <p v-if="relativeText" class="text-[10px] text-muted-foreground/60">{{ relativeText }}</p>
  </div>
</template>
```

- [ ] **Step 3: Create `CodeBadge.vue`**

```vue
<!-- app/components/app/CodeBadge.vue -->
<script setup lang="ts">
import { DECLARATION_STATUS_BADGE } from "~/utils/statusStyles";

const props = defineProps<{
  code: string;
  status?: string;
}>();

const badgeClass = computed(() => {
  if (!props.status) return "bg-muted text-muted-foreground";
  return DECLARATION_STATUS_BADGE[props.status] ?? "bg-muted text-muted-foreground";
});
</script>

<template>
  <span :class="[badgeClass, 'inline-flex items-center px-2.5 py-0.5 rounded-md font-mono text-xs font-semibold']">
    {{ code }}
  </span>
</template>
```

- [ ] **Step 4: Create `VerificationDots.vue`**

```vue
<!-- app/components/app/VerificationDots.vue -->
<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    count: number;
    max?: number;
  }>(),
  { max: 10 },
);

const filledDots = computed(() => Math.min(props.count, props.max));
const emptyDots = computed(() => Math.max(0, props.max - props.count));
const overflow = computed(() => (props.count > props.max ? props.count - props.max : 0));
</script>

<template>
  <div class="flex items-center gap-[3px]">
    <span
      v-for="i in filledDots"
      :key="'f' + i"
      class="w-2 h-2 rounded-full bg-primary"
    />
    <span
      v-for="i in emptyDots"
      :key="'e' + i"
      class="w-2 h-2 rounded-full bg-muted-foreground/20"
    />
    <span class="ml-1 text-xs text-muted-foreground tabular-nums">
      {{ count }}<template v-if="overflow">+</template>
    </span>
  </div>
</template>
```

- [ ] **Step 5: Commit**

```bash
git add app/components/app/UserCell.vue app/components/app/DateCell.vue app/components/app/CodeBadge.vue app/components/app/VerificationDots.vue
git commit -m "feat: add helper cell components (UserCell, DateCell, CodeBadge, VerificationDots)"
```

---

### Task 4: Enhanced `DataTable.vue` Component

**Files:**
- Modify: `app/components/app/DataTable.vue` (full rewrite)

- [ ] **Step 1: Replace DataTable.vue with full-featured version**

```vue
<!-- app/components/app/DataTable.vue -->
<script setup lang="ts" generic="T extends Record<string, unknown>">
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Skeleton } from "~/components/ui/skeleton";
import { getStatusBorderClass } from "~/utils/statusBorderColors";
import type { PaginationMeta } from "~/composables/useDataTable";

export interface DataTableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  class?: string;
  headerClass?: string;
}

const props = withDefaults(
  defineProps<{
    columns: DataTableColumn[];
    data: T[];
    loading?: boolean;
    striped?: boolean;
    hoverable?: boolean;
    statusBorderKey?: string;
    emptyMessage?: string;
    sortColumn?: string | null;
    sortDirection?: "asc" | "desc";
    meta?: PaginationMeta;
    skeletonRows?: number;
  }>(),
  {
    loading: false,
    striped: true,
    hoverable: true,
    emptyMessage: "No data found",
    sortColumn: null,
    sortDirection: "desc",
    skeletonRows: 5,
  },
);

const emit = defineEmits<{
  sort: [column: string];
  "page-change": [page: number];
  "row-click": [row: T];
}>();

function getCellValue(row: T, key: string): unknown {
  return key.split(".").reduce<unknown>((obj, k) => {
    if (obj && typeof obj === "object" && k in obj) return (obj as Record<string, unknown>)[k];
    return undefined;
  }, row);
}

function getRowBorderClass(row: T): string {
  if (!props.statusBorderKey) return "";
  const val = getCellValue(row, props.statusBorderKey);
  return getStatusBorderClass(val as string);
}

const alignClass = (align?: "left" | "center" | "right") => {
  if (align === "center") return "text-center";
  if (align === "right") return "text-right";
  return "text-left";
};

const showPagination = computed(
  () => props.meta && props.meta.lastPage > 1,
);

const pageNumbers = computed(() => {
  if (!props.meta) return [];
  const { page, lastPage } = props.meta;
  const pages: (number | "ellipsis")[] = [];

  pages.push(1);
  if (page > 3) pages.push("ellipsis");
  for (let i = Math.max(2, page - 1); i <= Math.min(lastPage - 1, page + 1); i++) {
    pages.push(i);
  }
  if (page < lastPage - 2) pages.push("ellipsis");
  if (lastPage > 1) pages.push(lastPage);

  return pages;
});
</script>

<template>
  <div>
    <div class="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead
              v-for="col in columns"
              :key="col.key"
              :class="[
                alignClass(col.align),
                col.headerClass,
                col.sortable ? 'cursor-pointer select-none hover:text-foreground transition-colors' : '',
              ]"
              @click="col.sortable ? emit('sort', col.key) : undefined"
            >
              <span class="inline-flex items-center gap-1">
                {{ col.label }}
                <template v-if="col.sortable && sortColumn === col.key">
                  <svg
                    class="w-3.5 h-3.5 text-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      v-if="sortDirection === 'asc'"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M5 15l7-7 7 7"
                    />
                    <path
                      v-else
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </template>
                <template v-else-if="col.sortable">
                  <svg
                    class="w-3.5 h-3.5 text-muted-foreground/40"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </template>
              </span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <!-- Loading -->
          <template v-if="loading">
            <TableRow v-for="i in skeletonRows" :key="'sk-' + i">
              <TableCell v-for="col in columns" :key="col.key">
                <Skeleton class="h-4 w-full" />
              </TableCell>
            </TableRow>
          </template>

          <!-- Empty -->
          <TableRow v-else-if="data.length === 0">
            <TableCell :colspan="columns.length" class="text-center py-12">
              <slot name="empty">
                <div class="text-muted-foreground">
                  <svg class="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p class="text-sm">{{ emptyMessage }}</p>
                </div>
              </slot>
            </TableCell>
          </TableRow>

          <!-- Data rows -->
          <template v-else>
            <TableRow
              v-for="(row, idx) in data"
              :key="idx"
              :class="[
                statusBorderKey ? ['border-l-3', getRowBorderClass(row)] : '',
                striped && idx % 2 === 1 ? 'bg-muted/30' : '',
                hoverable ? 'hover:bg-muted/50 transition-colors' : '',
                'cursor-pointer',
              ]"
              @click="emit('row-click', row)"
            >
              <TableCell
                v-for="col in columns"
                :key="col.key"
                :class="[alignClass(col.align), col.class]"
              >
                <slot :name="'cell-' + col.key" :row="row" :value="getCellValue(row, col.key)">
                  {{ getCellValue(row, col.key) ?? "-" }}
                </slot>
              </TableCell>
            </TableRow>
          </template>
        </TableBody>
      </Table>
    </div>

    <!-- Pagination -->
    <div v-if="showPagination && meta" class="flex items-center justify-between px-4 py-3 border-t">
      <p class="text-sm text-muted-foreground">
        Showing {{ (meta.page - 1) * meta.perPage + 1 }} to
        {{ Math.min(meta.page * meta.perPage, meta.total) }} of
        {{ meta.total }}
      </p>
      <div class="flex items-center gap-1">
        <button
          class="px-2.5 py-1.5 text-sm rounded-md border border-input hover:bg-muted disabled:opacity-40 disabled:pointer-events-none transition-colors"
          :disabled="meta.page <= 1"
          @click="emit('page-change', meta.page - 1)"
        >
          Previous
        </button>
        <template v-for="p in pageNumbers" :key="p">
          <span v-if="p === 'ellipsis'" class="px-1.5 text-muted-foreground">…</span>
          <button
            v-else
            class="w-8 h-8 text-sm rounded-md transition-colors"
            :class="p === meta.page
              ? 'bg-primary text-primary-foreground font-medium'
              : 'hover:bg-muted'"
            @click="emit('page-change', p)"
          >
            {{ p }}
          </button>
        </template>
        <button
          class="px-2.5 py-1.5 text-sm rounded-md border border-input hover:bg-muted disabled:opacity-40 disabled:pointer-events-none transition-colors"
          :disabled="meta.page >= meta.lastPage"
          @click="emit('page-change', meta.page + 1)"
        >
          Next
        </button>
      </div>
    </div>

    <!-- Footer slot -->
    <slot name="footer" />
  </div>
</template>

<style scoped>
.border-l-3 {
  border-left-width: 3px;
}
</style>
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /home/jude/code/alda/app && npx nuxi typecheck 2>&1 | head -30`

Expected: no errors related to `DataTable`

- [ ] **Step 3: Commit**

```bash
git add app/components/app/DataTable.vue
git commit -m "feat: replace DataTable with full-featured version (sort, pagination, status borders)"
```

---

### Task 5: Refactor Dashboard Tables

**Files:**
- Modify: `app/pages/admin/dashboard.vue` (lines 286–450 — tabbed tables section)

- [ ] **Step 1: Add composable instances and column definitions to the script setup**

Add the following to the `<script setup>` section of `dashboard.vue`, after the existing `quickActions` array (around line 155). Keep all existing code above unchanged (stats, charts, quick actions).

```typescript
// --- Tabbed tables: composable instances ---

const codeTable = useDataTable<RecentCode>("/api/admin/declarations", {
  perPage: 5,
  defaultSort: "createdAt",
  defaultDirection: "desc",
  itemsKey: "declarations",
});

const userTable = useDataTable<RecentUser>("/api/admin/users", {
  perPage: 5,
  defaultSort: "createdAt",
  defaultDirection: "desc",
  itemsKey: "users",
});

const declarationTable = useDataTable<RecentDeclaration>("/api/admin/declarations", {
  perPage: 5,
  defaultSort: "createdAt",
  defaultDirection: "desc",
  itemsKey: "declarations",
});

const auditTable = useDataTable<AuditLogEntry>("/api/admin/audit-logs", {
  perPage: 5,
  defaultSort: "createdAt",
  defaultDirection: "desc",
  itemsKey: "logs",
});

// --- Column definitions ---

const codeColumns: DataTableColumn[] = [
  { key: "uniqueCode", label: "Code", sortable: true },
  { key: "applicantName", label: "Applicant", sortable: true },
  { key: "status", label: "Status", sortable: true },
  { key: "verificationCount", label: "Verifications", sortable: true },
  { key: "isRegenerated", label: "Origin" },
  { key: "createdAt", label: "Issued", sortable: true },
];

const userColumns: DataTableColumn[] = [
  { key: "email", label: "Email", sortable: true },
  { key: "roles", label: "Roles" },
  { key: "isActive", label: "Status", sortable: true },
  { key: "createdAt", label: "Created", sortable: true },
];

const declarationColumns: DataTableColumn[] = [
  { key: "uniqueCode", label: "Code", sortable: true },
  { key: "applicantName", label: "Applicant", sortable: true },
  { key: "status", label: "Status", sortable: true },
  { key: "createdAt", label: "Created", sortable: true },
];

const auditColumns: DataTableColumn[] = [
  { key: "action", label: "Action", sortable: true },
  { key: "entityType", label: "Entity", sortable: true },
  { key: "userEmail", label: "User", sortable: true },
  { key: "ipAddress", label: "IP Address" },
  { key: "createdAt", label: "Time", sortable: true },
];
```

Also add the `DataTableColumn` import at the top of the script:

```typescript
import type { DataTableColumn } from "~/components/app/DataTable.vue";
```

- [ ] **Step 2: Replace the tabbed tables template**

Replace everything from `<!-- Tabbed Recent Activity -->` (line 285) to the closing `</Card>` of the tabs (line 450) with:

```vue
    <!-- Tabbed Recent Activity -->
    <Card>
      <Tabs default-value="codes">
        <CardHeader class="pb-0">
          <TabsList>
            <TabsTrigger value="codes">Recent Codes</TabsTrigger>
            <TabsTrigger value="users">Recent Users</TabsTrigger>
            <TabsTrigger value="declarations">Recent Declarations</TabsTrigger>
            <TabsTrigger value="audit">Audit Logs</TabsTrigger>
          </TabsList>
        </CardHeader>
        <CardContent class="pt-4">
          <!-- Recent Codes -->
          <TabsContent value="codes">
            <AppDataTable
              :columns="codeColumns"
              :data="codeTable.data.value"
              :loading="codeTable.loading.value"
              :meta="codeTable.meta.value"
              :sort-column="codeTable.sortColumn.value"
              :sort-direction="codeTable.sortDirection.value"
              status-border-key="status"
              empty-message="No codes issued yet."
              @sort="codeTable.setSort"
              @page-change="codeTable.setPage"
            >
              <template #cell-uniqueCode="{ row }">
                <AppCodeBadge :code="(row as RecentCode).uniqueCode" :status="(row as RecentCode).status" />
              </template>
              <template #cell-applicantName="{ row }">
                <AppUserCell :name="(row as RecentCode).applicantName" />
              </template>
              <template #cell-status="{ value }">
                <StatusBadge :status="(value as string)" />
              </template>
              <template #cell-verificationCount="{ value }">
                <AppVerificationDots :count="(value as number) ?? 0" />
              </template>
              <template #cell-isRegenerated="{ value }">
                <Badge :class="(value as boolean)
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300'">
                  {{ (value as boolean) ? 'Reissued' : 'Initial' }}
                </Badge>
              </template>
              <template #cell-createdAt="{ value }">
                <AppDateCell :date="(value as string)" relative />
              </template>
            </AppDataTable>
          </TabsContent>

          <!-- Recent Users -->
          <TabsContent value="users">
            <AppDataTable
              :columns="userColumns"
              :data="userTable.data.value"
              :loading="userTable.loading.value"
              :meta="userTable.meta.value"
              :sort-column="userTable.sortColumn.value"
              :sort-direction="userTable.sortDirection.value"
              status-border-key="isActive"
              empty-message="No users found."
              @sort="userTable.setSort"
              @page-change="userTable.setPage"
            >
              <template #cell-email="{ row }">
                <AppUserCell :name="(row as RecentUser).email" />
              </template>
              <template #cell-roles="{ value }">
                <div class="flex gap-1">
                  <Badge v-for="role in (value as string[])" :key="role" variant="secondary">
                    {{ role }}
                  </Badge>
                </div>
              </template>
              <template #cell-isActive="{ value }">
                <Badge :class="(value as boolean)
                  ? 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300'
                  : 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300'">
                  {{ (value as boolean) ? 'Active' : 'Inactive' }}
                </Badge>
              </template>
              <template #cell-createdAt="{ value }">
                <AppDateCell :date="(value as string)" relative />
              </template>
              <template #footer>
                <div class="px-4 py-3 border-t">
                  <NuxtLink to="/admin/users" class="text-sm text-primary hover:underline">
                    View all users &rarr;
                  </NuxtLink>
                </div>
              </template>
            </AppDataTable>
          </TabsContent>

          <!-- Recent Declarations -->
          <TabsContent value="declarations">
            <AppDataTable
              :columns="declarationColumns"
              :data="declarationTable.data.value"
              :loading="declarationTable.loading.value"
              :meta="declarationTable.meta.value"
              :sort-column="declarationTable.sortColumn.value"
              :sort-direction="declarationTable.sortDirection.value"
              status-border-key="status"
              empty-message="No declarations found."
              @sort="declarationTable.setSort"
              @page-change="declarationTable.setPage"
            >
              <template #cell-uniqueCode="{ row }">
                <AppCodeBadge :code="(row as RecentDeclaration).uniqueCode" :status="(row as RecentDeclaration).status" />
              </template>
              <template #cell-applicantName="{ row }">
                <AppUserCell :name="(row as RecentDeclaration).applicantName" />
              </template>
              <template #cell-status="{ value }">
                <StatusBadge :status="(value as string)" />
              </template>
              <template #cell-createdAt="{ value }">
                <AppDateCell :date="(value as string)" relative />
              </template>
            </AppDataTable>
          </TabsContent>

          <!-- Audit Logs -->
          <TabsContent value="audit">
            <AppDataTable
              :columns="auditColumns"
              :data="auditTable.data.value"
              :loading="auditTable.loading.value"
              :meta="auditTable.meta.value"
              :sort-column="auditTable.sortColumn.value"
              :sort-direction="auditTable.sortDirection.value"
              status-border-key="action"
              empty-message="No audit logs found."
              @sort="auditTable.setSort"
              @page-change="auditTable.setPage"
            >
              <template #cell-action="{ value }">
                <Badge :class="getActionColor((value as string))">
                  {{ value }}
                </Badge>
              </template>
              <template #cell-entityType="{ value }">
                <span class="text-sm text-muted-foreground">{{ (value as string) || '-' }}</span>
              </template>
              <template #cell-userEmail="{ value }">
                <span class="text-sm">{{ (value as string) || 'System' }}</span>
              </template>
              <template #cell-ipAddress="{ value }">
                <span class="text-sm font-mono text-muted-foreground">{{ (value as string) || '-' }}</span>
              </template>
              <template #cell-createdAt="{ value }">
                <AppDateCell :date="(value as string)" relative />
              </template>
              <template #footer>
                <div class="px-4 py-3 border-t">
                  <NuxtLink to="/admin/audit-logs" class="text-sm text-primary hover:underline">
                    View all audit logs &rarr;
                  </NuxtLink>
                </div>
              </template>
            </AppDataTable>
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
```

- [ ] **Step 3: Add `getActionColor` helper and `TONE_BADGE` import**

Add to the script setup section (near `formatDate`):

```typescript
import { TONE_BADGE } from "~/utils/statusStyles";

function getActionColor(action: string): string {
  if (action.includes("CREATE") || action.includes("REGISTER")) return TONE_BADGE.green;
  if (action.includes("DELETE") || action.includes("REMOVE")) return TONE_BADGE.red;
  if (action.includes("UPDATE") || action.includes("EDIT")) return TONE_BADGE.blue;
  if (action.includes("LOGIN") || action.includes("LOGOUT")) return TONE_BADGE.purple;
  return TONE_BADGE.neutral;
}
```

- [ ] **Step 4: Remove the old `dashboard` loading ref usage for tables**

The dashboard page currently uses `const { data: dashboard, loading } = useDashboardStats<AdminDashboardData>(...)` and passes `loading` and `dashboard?.recentCodes` etc. to the tabs. Now each tab has its own composable, so the `recentUsers`, `recentDeclarations`, `recentCodes`, and `recentAuditLogs` fields of `AdminDashboardData` are no longer needed in the template.

Keep the `useDashboardStats` call and the `AdminDashboardData` interface — they're still used for stats, lifecycle, funnel, and throughput data. Just remove the `recentUsers`, `recentDeclarations`, `recentCodes`, and `recentAuditLogs` fields from the `AdminDashboardData` interface since they're now fetched by individual composables.

- [ ] **Step 5: Verify the dev server renders**

Run: `cd /home/jude/code/alda/app && npm run dev`

Navigate to `http://localhost:3000/admin/dashboard`, log in as admin, and verify:
- All 4 tabs render with the new DataTable
- Status-colored left borders appear on rows
- Sorting works (click column headers)
- Pagination works (if there are > 5 items)
- Helper components render correctly (avatars, date cells, code badges)

- [ ] **Step 6: Commit**

```bash
git add app/pages/admin/dashboard.vue
git commit -m "feat: refactor dashboard tabs to use AppDataTable with rich styling"
```

---

### Task 6: Adopt DataTable on `/admin/users` Page

**Files:**
- Modify: `app/pages/admin/users.vue`

- [ ] **Step 1: Replace manual fetch/pagination with `useDataTable`**

Replace the manual state and fetch logic (lines 33–72 of the current file) with the composable. Keep the modal logic (`showEditModal`, `editingUser`, `saveUserRoles`, `toggleUserStatus`) as-is. Replace the entire `<script setup>` with:

```typescript
<script setup lang="ts">
import type { DataTableColumn } from "~/components/app/DataTable.vue";
import { TONE_BADGE } from "~/utils/statusStyles";

definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

interface User {
  id: string;
  email: string;
  phone: string | null;
  emailVerified: boolean;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  roles: string[];
  profile: {
    fullName: string;
    ghanaCardNumber: string;
    offices: Array<{
      designation: string;
      officeCategory: { name: string } | null;
      institution: { name: string } | null;
    }>;
  } | null;
}

interface Role {
  id: number;
  name: string;
  description: string | null;
}

const table = useDataTable<User>("/api/admin/users", {
  perPage: 20,
  defaultSort: "createdAt",
  defaultDirection: "desc",
  itemsKey: "users",
});

// Roles for edit modal
const roles = ref<Role[]>([]);
const showEditModal = ref(false);
const editingUser = ref<User | null>(null);
const selectedRoles = ref<number[]>([]);
const saving = ref(false);

onMounted(async () => {
  try {
    const response = await authFetch<any>("/api/admin/roles");
    if (response.success) roles.value = response.data.roles;
  } catch (error) {
    console.error("Failed to fetch roles:", error);
  }
});

const columns: DataTableColumn[] = [
  { key: "email", label: "User", sortable: true },
  { key: "roles", label: "Roles" },
  { key: "isActive", label: "Status", sortable: true },
  { key: "lastLoginAt", label: "Last Login", sortable: true },
  { key: "createdAt", label: "Created", sortable: true },
  { key: "actions", label: "Actions" },
];

const openEditModal = (user: User) => {
  editingUser.value = user;
  selectedRoles.value = roles.value
    .filter((r) => user.roles.includes(r.name))
    .map((r) => r.id);
  showEditModal.value = true;
};

const closeEditModal = () => {
  showEditModal.value = false;
  editingUser.value = null;
  selectedRoles.value = [];
};

const saveUserRoles = async () => {
  if (!editingUser.value) return;
  saving.value = true;
  try {
    const response = await authFetch<any>(`/api/admin/users/${editingUser.value.id}/roles`, {
      method: "PUT",
      body: { roleIds: selectedRoles.value },
    });
    if (response.success) {
      table.refresh();
      closeEditModal();
    }
  } catch (error) {
    console.error("Failed to update user roles:", error);
  } finally {
    saving.value = false;
  }
};

const toggleUserStatus = async (user: User) => {
  try {
    const response = await authFetch<any>(`/api/admin/users/${user.id}/status`, {
      method: "PATCH",
      body: { isActive: !user.isActive },
    });
    if (response.success) {
      table.refresh();
    }
  } catch (error) {
    console.error("Failed to toggle user status:", error);
  }
};
</script>
```

- [ ] **Step 2: Replace the template table section**

Replace the filters card, loading skeletons, and table card with:

```vue
<template>
  <div class="space-y-6">
    <PageHeader title="User Management" description="Manage system users and their roles" />

    <!-- Filters -->
    <Card>
      <CardContent class="pt-6">
        <div class="flex flex-col md:flex-row gap-4">
          <div class="flex-1">
            <Input
              :model-value="table.search.value"
              type="text"
              placeholder="Search by email or name..."
              @update:model-value="table.setSearch($event)"
            />
          </div>
          <Select
            :model-value="table.filters.value.role || 'all'"
            @update:model-value="table.setFilter('role', $event)"
          >
            <SelectTrigger class="w-[180px]">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem v-for="role in roles" :key="role.id" :value="role.name">
                {{ role.name }}
              </SelectItem>
            </SelectContent>
          </Select>
          <Select
            :model-value="table.filters.value.status || 'all'"
            @update:model-value="table.setFilter('status', $event)"
          >
            <SelectTrigger class="w-[180px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Button
            v-if="table.hasActiveFilters.value"
            variant="outline"
            @click="table.clearFilters()"
          >
            Clear
          </Button>
        </div>
      </CardContent>
    </Card>

    <!-- Users Table -->
    <Card>
      <AppDataTable
        :columns="columns"
        :data="table.data.value"
        :loading="table.loading.value"
        :meta="table.meta.value"
        :sort-column="table.sortColumn.value"
        :sort-direction="table.sortDirection.value"
        status-border-key="isActive"
        empty-message="No users found"
        @sort="table.setSort"
        @page-change="table.setPage"
      >
        <template #cell-email="{ row }">
          <AppUserCell
            :name="(row as User).profile?.fullName || (row as User).email"
            :email="(row as User).email"
          />
        </template>
        <template #cell-roles="{ value }">
          <div class="flex flex-wrap gap-1">
            <Badge v-for="role in (value as string[])" :key="role" variant="secondary">
              {{ role }}
            </Badge>
          </div>
        </template>
        <template #cell-isActive="{ value }">
          <Badge :class="(value as boolean)
            ? 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300'
            : 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300'">
            {{ (value as boolean) ? 'Active' : 'Inactive' }}
          </Badge>
        </template>
        <template #cell-lastLoginAt="{ value }">
          <AppDateCell v-if="value" :date="(value as string)" />
          <span v-else class="text-sm text-muted-foreground">Never</span>
        </template>
        <template #cell-createdAt="{ value }">
          <AppDateCell :date="(value as string)" />
        </template>
        <template #cell-actions="{ row }">
          <div class="flex items-center gap-2">
            <Button variant="outline" size="sm" @click.stop="openEditModal(row as User)">
              Edit Roles
            </Button>
            <Button
              variant="outline"
              size="sm"
              :class="(row as User).isActive
                ? 'text-red-600 hover:text-red-700 dark:text-red-400'
                : 'text-green-600 hover:text-green-700 dark:text-green-400'"
              @click.stop="toggleUserStatus(row as User)"
            >
              {{ (row as User).isActive ? 'Deactivate' : 'Activate' }}
            </Button>
          </div>
        </template>
      </AppDataTable>
    </Card>

    <!-- Edit Roles Modal (unchanged) -->
    <Dialog :open="showEditModal" @update:open="(v: boolean) => { if (!v) closeEditModal() }">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit User Roles</DialogTitle>
          <DialogDescription>{{ editingUser?.email }}</DialogDescription>
        </DialogHeader>
        <div class="space-y-3">
          <label
            v-for="role in roles"
            :key="role.id"
            class="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
          >
            <input v-model="selectedRoles" type="checkbox" :value="role.id" class="w-4 h-4" />
            <div>
              <p class="text-sm font-medium text-foreground">{{ role.name }}</p>
              <p v-if="role.description" class="text-xs text-muted-foreground">{{ role.description }}</p>
            </div>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="closeEditModal">Cancel</Button>
          <Button :disabled="saving" @click="saveUserRoles">
            {{ saving ? 'Saving...' : 'Save Changes' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
```

- [ ] **Step 3: Verify in browser**

Navigate to `/admin/users`, confirm:
- Table renders with avatars, role badges, status badges, date cells
- Left borders colored by active/inactive status
- Sorting works
- Pagination works
- Search and filter dropdowns work
- Edit Roles and Activate/Deactivate still function

- [ ] **Step 4: Commit**

```bash
git add app/pages/admin/users.vue
git commit -m "refactor: adopt AppDataTable on admin users page"
```

---

### Task 7: Adopt DataTable on `/admin/audit-logs` Page

**Files:**
- Modify: `app/pages/admin/audit-logs.vue`

- [ ] **Step 1: Replace script setup with composable-based version**

```typescript
<script setup lang="ts">
import type { DataTableColumn } from "~/components/app/DataTable.vue";
import { TONE_BADGE } from "~/utils/statusStyles";

definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

interface AuditLog {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  oldValues: unknown;
  newValues: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
  } | null;
}

const table = useDataTable<AuditLog>("/api/admin/audit-logs", {
  perPage: 50,
  defaultSort: "createdAt",
  defaultDirection: "desc",
  itemsKey: "logs",
});

const showDetailModal = ref(false);
const selectedLog = ref<AuditLog | null>(null);

const columns: DataTableColumn[] = [
  { key: "createdAt", label: "Time", sortable: true },
  { key: "action", label: "Action", sortable: true },
  { key: "entityType", label: "Entity", sortable: true },
  { key: "user", label: "User", sortable: true },
  { key: "ipAddress", label: "IP Address" },
  { key: "details", label: "Details" },
];

function getActionColor(action: string): string {
  if (action.includes("CREATE") || action.includes("REGISTER")) return TONE_BADGE.green;
  if (action.includes("DELETE") || action.includes("REMOVE")) return TONE_BADGE.red;
  if (action.includes("UPDATE") || action.includes("EDIT")) return TONE_BADGE.blue;
  if (action.includes("LOGIN") || action.includes("LOGOUT")) return TONE_BADGE.purple;
  return TONE_BADGE.neutral;
}

const openDetailModal = (log: AuditLog) => {
  selectedLog.value = log;
  showDetailModal.value = true;
};

const closeDetailModal = () => {
  showDetailModal.value = false;
  selectedLog.value = null;
};

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

const actionTypes = [
  "LOGIN", "LOGOUT", "REGISTER", "PASSWORD_RESET",
  "DECLARATION_CREATE", "DECLARATION_SUBMIT", "DECLARATION_APPROVE", "DECLARATION_REJECT",
  "SECTION_REVIEW_SUBMITTED", "SECTION_REVIEW_RESOLVED",
  "RECEIPT_GENERATE", "USER_UPDATE", "ROLE_ASSIGN",
];

const entityTypes = [
  "User", "Declaration", "DeclarationSectionReview", "Review", "Receipt", "Institution",
];
</script>
```

- [ ] **Step 2: Replace the template**

```vue
<template>
  <div class="space-y-6">
    <PageHeader title="Audit Logs" description="View system activity and changes" />

    <!-- Filters -->
    <Card>
      <CardContent class="pt-6">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Input
            :model-value="table.search.value"
            type="text"
            placeholder="Search by user email or IP..."
            @update:model-value="table.setSearch($event)"
          />
          <Select
            :model-value="table.filters.value.action || 'all'"
            @update:model-value="table.setFilter('action', $event)"
          >
            <SelectTrigger>
              <SelectValue placeholder="All Actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem v-for="action in actionTypes" :key="action" :value="action">
                {{ action }}
              </SelectItem>
            </SelectContent>
          </Select>
          <Select
            :model-value="table.filters.value.entityType || 'all'"
            @update:model-value="table.setFilter('entityType', $event)"
          >
            <SelectTrigger>
              <SelectValue placeholder="All Entities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entities</SelectItem>
              <SelectItem v-for="entity in entityTypes" :key="entity" :value="entity">
                {{ entity }}
              </SelectItem>
            </SelectContent>
          </Select>
          <div class="flex gap-2">
            <Input
              :model-value="table.filters.value.dateFrom || ''"
              type="date"
              class="flex-1"
              @update:model-value="table.setFilter('dateFrom', $event)"
            />
            <Input
              :model-value="table.filters.value.dateTo || ''"
              type="date"
              class="flex-1"
              @update:model-value="table.setFilter('dateTo', $event)"
            />
          </div>
        </div>
        <div class="flex justify-end mt-4 gap-2">
          <Button
            v-if="table.hasActiveFilters.value"
            variant="outline"
            @click="table.clearFilters()"
          >
            Clear Filters
          </Button>
        </div>
      </CardContent>
    </Card>

    <!-- Audit Logs Table -->
    <Card>
      <AppDataTable
        :columns="columns"
        :data="table.data.value"
        :loading="table.loading.value"
        :meta="table.meta.value"
        :sort-column="table.sortColumn.value"
        :sort-direction="table.sortDirection.value"
        status-border-key="action"
        empty-message="No audit logs found"
        @sort="table.setSort"
        @page-change="table.setPage"
        @row-click="(row: AuditLog) => { if (row.oldValues || row.newValues) openDetailModal(row) }"
      >
        <template #cell-createdAt="{ value }">
          <AppDateCell :date="(value as string)" relative />
        </template>
        <template #cell-action="{ value }">
          <Badge :class="getActionColor((value as string))">
            {{ value }}
          </Badge>
        </template>
        <template #cell-entityType="{ row }">
          <span class="text-sm text-muted-foreground">
            <template v-if="(row as AuditLog).entityType">
              {{ (row as AuditLog).entityType }}
              <span v-if="(row as AuditLog).entityId" class="text-xs opacity-60">
                ({{ (row as AuditLog).entityId!.substring(0, 8) }}…)
              </span>
            </template>
            <template v-else>-</template>
          </span>
        </template>
        <template #cell-user="{ row }">
          <AppUserCell
            v-if="(row as AuditLog).user"
            :name="(row as AuditLog).user!.email"
          />
          <span v-else class="text-sm text-muted-foreground">System</span>
        </template>
        <template #cell-ipAddress="{ value }">
          <span class="text-sm font-mono text-muted-foreground">{{ (value as string) || '-' }}</span>
        </template>
        <template #cell-details="{ row }">
          <Button
            v-if="(row as AuditLog).oldValues || (row as AuditLog).newValues"
            variant="outline"
            size="sm"
            @click.stop="openDetailModal(row as AuditLog)"
          >
            View
          </Button>
          <span v-else class="text-xs text-muted-foreground">-</span>
        </template>
      </AppDataTable>
    </Card>

    <!-- Detail Modal (unchanged) -->
    <Dialog :open="showDetailModal && !!selectedLog" @update:open="(v: boolean) => { if (!v) closeDetailModal() }">
      <DialogScrollContent v-if="selectedLog" class="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Audit Log Details</DialogTitle>
        </DialogHeader>
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p class="text-muted-foreground">Action</p>
              <p class="font-medium text-foreground">{{ selectedLog.action }}</p>
            </div>
            <div>
              <p class="text-muted-foreground">Time</p>
              <p class="font-medium text-foreground">{{ formatDate(selectedLog.createdAt) }}</p>
            </div>
            <div>
              <p class="text-muted-foreground">User</p>
              <p class="font-medium text-foreground">{{ selectedLog.user?.email || 'System' }}</p>
            </div>
            <div>
              <p class="text-muted-foreground">IP Address</p>
              <p class="font-medium font-mono text-foreground">{{ selectedLog.ipAddress || '-' }}</p>
            </div>
            <div>
              <p class="text-muted-foreground">Entity Type</p>
              <p class="font-medium text-foreground">{{ selectedLog.entityType || '-' }}</p>
            </div>
            <div>
              <p class="text-muted-foreground">Entity ID</p>
              <p class="font-medium font-mono text-foreground text-xs">{{ selectedLog.entityId || '-' }}</p>
            </div>
          </div>
          <div v-if="selectedLog.userAgent" class="text-sm">
            <p class="text-muted-foreground mb-1">User Agent</p>
            <p class="text-xs font-mono text-foreground bg-muted p-2 rounded">{{ selectedLog.userAgent }}</p>
          </div>
          <div v-if="selectedLog.oldValues" class="text-sm">
            <p class="text-muted-foreground mb-1">Old Values</p>
            <pre class="text-xs font-mono text-foreground bg-muted p-3 rounded overflow-x-auto">{{ JSON.stringify(selectedLog.oldValues, null, 2) }}</pre>
          </div>
          <div v-if="selectedLog.newValues" class="text-sm">
            <p class="text-muted-foreground mb-1">New Values</p>
            <pre class="text-xs font-mono text-foreground bg-muted p-3 rounded overflow-x-auto">{{ JSON.stringify(selectedLog.newValues, null, 2) }}</pre>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="closeDetailModal">Close</Button>
        </DialogFooter>
      </DialogScrollContent>
    </Dialog>
  </div>
</template>
```

- [ ] **Step 3: Verify in browser**

Navigate to `/admin/audit-logs`, confirm:
- Table renders with action badges, entity info, user cells, IP addresses
- Left borders colored by action type
- Sorting, pagination, search, and filters all work
- Detail modal opens on "View" button click
- Clear Filters button works

- [ ] **Step 4: Commit**

```bash
git add app/pages/admin/audit-logs.vue
git commit -m "refactor: adopt AppDataTable on admin audit-logs page"
```

---

### Task 8: Final Verification & Cleanup

- [ ] **Step 1: Run typecheck**

```bash
cd /home/jude/code/alda/app && npx nuxi typecheck
```

Fix any type errors.

- [ ] **Step 2: Run linter**

```bash
cd /home/jude/code/alda/app && npm run lint
```

Fix any lint issues.

- [ ] **Step 3: Visual verification of all 3 pages**

Test in the browser:
1. `/admin/dashboard` — all 4 tabs render correctly, pagination works per tab, sort works
2. `/admin/users` — search, filter, sort, pagination, edit roles, toggle status
3. `/admin/audit-logs` — search, filter, sort, pagination, detail modal

Test dark mode on each page.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve type and lint issues from DataTable adoption"
```

- [ ] **Step 5: Verify the `statusBorderKey` handles the `isActive` boolean**

The users table passes `isActive` (a boolean) as the status border key. The `getStatusBorderClass` function maps string keys. For booleans, the DataTable component needs to convert the value to a string. Check that `getStatusBorderClass` receives `"true"` or `"false"` and add mappings if needed:

Add to `statusBorderColors.ts`:
```typescript
  true: "border-l-green-500 dark:border-l-green-400",
  false: "border-l-red-400 dark:border-l-red-500",
```

Since the value is coerced to a string via `val as string`, this mapping will work.

- [ ] **Step 6: Final commit**

```bash
git add app/utils/statusBorderColors.ts
git commit -m "fix: add boolean status border mappings for user active/inactive"
```
