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
