<!-- app/components/app/DataTable.vue -->
<script setup lang="ts" generic="T extends Record<string, any>">
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
    statusBorderKey: undefined,
    emptyMessage: "No data found",
    sortColumn: null,
    sortDirection: "desc",
    meta: undefined,
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
