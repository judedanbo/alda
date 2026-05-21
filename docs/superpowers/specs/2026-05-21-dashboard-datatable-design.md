# Dashboard DataTable Enhancement

## Summary

Upgrade the 4 admin dashboard tables (Recent Codes, Recent Users, Recent Declarations, Audit Logs) with a rich visual treatment and extract a full-featured reusable `AppDataTable` component backed by a `useDataTable` composable. Additionally adopt the new component on `/admin/users` and `/admin/audit-logs` to prove it works across contexts.

## Visual Style: Rich & Visual (Option B)

Every table row gets:
- **Colored left border** derived from a status field (green=active, yellow=pending, red=revoked/rejected, blue=info, gray=default)
- **Avatar initials** in the applicant/user column with color-coded circles
- **Dot-indicator badges** for status (colored dot + label, pill-shaped, with subtle border)
- **Bordered origin/role badges** with tinted backgrounds
- **Verification dot visualization** (filled dots = verified count, empty = remaining)
- **Dual-line date cells** — formatted date + relative time below
- **Monospace code cells** in status-tinted pill backgrounds
- **Alternating row tint** and **hover highlight**

## Architecture: Composable + Component (Approach B)

### `useDataTable<T>` Composable

**File:** `app/composables/useDataTable.ts`

Manages sort state, pagination, search, filters, and data fetching. Returns reactive state and actions.

**Signature:**
```typescript
function useDataTable<T>(endpoint: string, options?: DataTableOptions): DataTableReturn<T>

interface DataTableOptions {
  perPage?: number           // default: 10
  defaultSort?: string       // column key
  defaultDirection?: 'asc' | 'desc'  // default: 'desc'
  immediate?: boolean        // fetch on creation (default: true)
  debounce?: number          // search debounce ms (default: 300)
}

interface DataTableReturn<T> {
  // Reactive state
  data: Ref<T[]>
  loading: Ref<boolean>
  meta: Ref<PaginationMeta>
  sortColumn: Ref<string | null>
  sortDirection: Ref<'asc' | 'desc'>
  search: Ref<string>
  filters: Ref<Record<string, string>>
  hasActiveFilters: ComputedRef<boolean>

  // Actions
  fetchData: (overrides?: Record<string, unknown>) => Promise<void>
  setSort: (column: string) => void
  setPage: (page: number) => void
  setSearch: (term: string) => void
  setFilter: (key: string, value: string) => void
  clearFilters: () => void
  refresh: () => void
}

interface PaginationMeta {
  page: number
  perPage: number
  total: number
  lastPage: number
}
```

**Behavior:**
- `setSort(column)` toggles asc/desc when clicking the same column, switches to desc on new column, resets to page 1, refetches
- `setSearch(term)` debounces, resets to page 1, refetches
- `setFilter(key, value)` sets a query param, resets to page 1, refetches. Empty string removes the filter.
- `clearFilters()` wipes search + all filters, refetches
- `setPage(page)` refetches with the new page number
- `refresh()` refetches with current params
- All params composed into a single `$fetch` call: `{ page, perPage, sortBy, sortDir, search, ...filters }`
- Uses the Nuxt `$fetch` utility with auth headers from the auth store (same pattern as existing API calls in the project)

### `AppDataTable` Component

**File:** `app/components/app/DataTable.vue` (replaces existing unused component)

Presentational component wrapping shadcn-vue `Table` primitives with the Rich Visual style.

**Props:**
```typescript
interface DataTableColumn {
  key: string
  label: string
  sortable?: boolean
  align?: 'left' | 'center' | 'right'
  class?: string
  headerClass?: string
}

interface Props<T> {
  columns: DataTableColumn[]
  data: T[]
  loading?: boolean
  striped?: boolean              // default: true
  hoverable?: boolean            // default: true
  statusBorderKey?: string       // column key to derive left-border color
  emptyMessage?: string          // default: "No data found"
  emptyIcon?: string             // lucide icon name

  // Sort state (from composable)
  sortColumn?: string | null
  sortDirection?: 'asc' | 'desc'

  // Pagination state (from composable)
  meta?: PaginationMeta
}
```

**Emits:**
- `sort(column: string)` — sortable column header clicked
- `page-change(page: number)` — pagination control clicked
- `row-click(row: T)` — table row clicked

**Slots:**
- `#cell-{key}="{ row, value }"` — custom cell content per column
- `#header-{key}="{ column }"` — custom header content
- `#empty` — override empty state
- `#footer` — content below table (e.g., "View all" link)

**Rendering details:**
- Wraps `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell` from shadcn-vue
- Sortable headers show ▲/▼ indicators, active sort highlighted
- Left border color resolved via a `statusColorMap` from the `statusBorderKey` value (configurable per-table through a prop or CSS variable)
- Loading state: 5 skeleton rows matching column count
- Empty state: centered icon + message
- Pagination footer: uses shadcn-vue `Pagination` components, only renders when `meta` is provided and `lastPage > 1`
- `striped`: alternating `bg-muted/30` on even rows
- `hoverable`: `hover:bg-muted/50` transition on rows

### Helper Cell Components

Small, focused components for rendering rich cell content. Located in `app/components/app/` alongside the DataTable.

**`UserCell.vue`**
- Props: `name: string`, `email?: string`, `avatarColor?: string`
- Renders: 28px avatar circle with initials + name + optional email subtitle
- Avatar background cycles through Ghana palette colors based on name hash

**`DateCell.vue`**
- Props: `date: string`, `relative?: boolean`
- Renders: formatted date (e.g., "May 20, 2026"), with optional "2 days ago" line below in muted text

**`CodeBadge.vue`**
- Props: `code: string`, `status?: string`
- Renders: monospace code in a tinted pill (background color derived from status)

**`VerificationDots.vue`**
- Props: `count: number`, `max?: number` (default: 10)
- Renders: row of small dots — filled for verified, empty for remaining — plus the count number
- If count > max, shows filled dots up to max with "+N" text

## Dashboard Integration

### Data Flow

Each tab in the dashboard card gets its own `useDataTable` instance. The dashboard `script setup` becomes:

```typescript
const codeTable = useDataTable<RecentCode>('/api/admin/stats/recent-codes', {
  perPage: 5, defaultSort: 'createdAt', defaultDirection: 'desc'
})
const userTable = useDataTable<RecentUser>('/api/admin/stats/recent-users', {
  perPage: 5, defaultSort: 'createdAt', defaultDirection: 'desc'
})
const declarationTable = useDataTable<RecentDeclaration>('/api/admin/stats/recent-declarations', {
  perPage: 5, defaultSort: 'createdAt', defaultDirection: 'desc'
})
const auditTable = useDataTable<AuditLogEntry>('/api/admin/stats/recent-audit-logs', {
  perPage: 5, defaultSort: 'createdAt', defaultDirection: 'desc'
})
```

### Tab Template Pattern

Each tab follows this pattern (Recent Codes shown):

```vue
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
      <CodeBadge :code="row.uniqueCode" :status="row.status" />
    </template>
    <template #cell-applicantName="{ row }">
      <UserCell :name="row.applicantName" :email="row.email" />
    </template>
    <template #cell-status="{ value }">
      <StatusBadge :status="value" />
    </template>
    <template #cell-verificationCount="{ value }">
      <VerificationDots :count="value" />
    </template>
    <template #cell-isRegenerated="{ value }">
      <Badge :variant="value ? 'outline' : 'secondary'"
             :class="value
               ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
               : 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300'">
        {{ value ? 'Reissued' : 'Initial' }}
      </Badge>
    </template>
    <template #cell-createdAt="{ value }">
      <DateCell :date="value" relative />
    </template>
  </AppDataTable>
</TabsContent>
```

### Column Definitions

**Recent Codes:**
| Key | Label | Sortable |
|-----|-------|----------|
| uniqueCode | Code | yes |
| applicantName | Applicant | yes |
| status | Status | yes |
| verificationCount | Verifications | yes |
| isRegenerated | Origin | no |
| createdAt | Issued | yes |

**Recent Users:**
| Key | Label | Sortable |
|-----|-------|----------|
| email | Email | yes |
| roles | Roles | no |
| isActive | Status | yes |
| createdAt | Created | yes |

**Recent Declarations:**
| Key | Label | Sortable |
|-----|-------|----------|
| uniqueCode | Code | yes |
| applicantName | Applicant | yes |
| status | Status | yes |
| createdAt | Created | yes |

**Audit Logs:**
| Key | Label | Sortable |
|-----|-------|----------|
| action | Action | yes |
| entityType | Entity | yes |
| userEmail | User | yes |
| ipAddress | IP Address | no |
| createdAt | Time | yes |

## List Page Adoption

### `/admin/users` page

Replace the existing manual table with `AppDataTable`. The page already has search + role/status filter dropdowns — wire them to `useDataTable.setSearch` and `useDataTable.setFilter`. Existing cell slot content (avatar, role badges, status badges, last login) moves into `#cell-*` slots.

### `/admin/audit-logs` page

This page currently renders audit logs as stacked cards, not a table. Convert to `AppDataTable` with:
- Action column: icon + action text (reuse the existing icon mapping)
- Entity column: entity type + ID
- User column: `UserCell` with name/email
- IP Address column: monospace
- Time column: `DateCell` with relative time
- Row click opens the existing detail modal
- Search + action filter dropdown wired to composable

## API Compatibility

The composable expects API endpoints that return `{ data: T[], meta: { page, perPage, total, lastPage } }`. The existing dashboard stats endpoint (`/api/admin/stats`) returns all recent data in a single response. Two options:

**Option chosen: Separate paginated endpoints.** Create lightweight paginated endpoints for each tab:
- `GET /api/admin/codes?page=1&perPage=5&sortBy=createdAt&sortDir=desc`
- `GET /api/admin/users?page=1&perPage=5&...`
- `GET /api/admin/declarations?page=1&perPage=5&...`
- `GET /api/admin/audit-logs?page=1&perPage=5&...`

These endpoints likely already exist or can be added to existing route handlers with pagination support. The dashboard's initial load fires 4 parallel requests instead of 1, but each is small and cacheable.

## Files to Create/Modify

### New files:
- `app/composables/useDataTable.ts` — composable
- `app/components/app/UserCell.vue` — avatar + name helper
- `app/components/app/DateCell.vue` — date + relative time helper
- `app/components/app/CodeBadge.vue` — monospace code pill
- `app/components/app/VerificationDots.vue` — dot visualization

### Modified files:
- `app/components/app/DataTable.vue` — replace with full-featured version
- `app/pages/admin/dashboard.vue` — refactor tabs to use AppDataTable
- `app/pages/admin/users/index.vue` — adopt AppDataTable (if exists at this path)
- `app/pages/admin/audit-logs/index.vue` — adopt AppDataTable (if exists at this path)

### Potentially new API routes (if not already paginated):
- Server routes for paginated codes, users, declarations, audit-logs (verify existing endpoints first)

## Dark Mode

All visual elements use Tailwind dark mode variants:
- Left border colors: same hues, adjusted for dark backgrounds
- Avatar circles: same colors (sufficient contrast on dark)
- Badge backgrounds: `dark:bg-{color}-950/50` with `dark:text-{color}-300`
- Alternating rows: `dark:bg-muted/20`
- Skeleton loading: uses shadcn-vue Skeleton which handles dark mode
- Muted text: `text-muted-foreground` (theme-aware)

## Out of Scope

- Bulk selection/actions on dashboard tables (no checkboxes)
- Column resizing or reordering
- Client-side sorting (all sorting is server-side via API params)
- Export/download functionality
- Inline editing
- Adopting the component on pages beyond /admin/users and /admin/audit-logs
