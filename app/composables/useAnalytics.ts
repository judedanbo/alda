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

function buildQueryString(filters: Partial<AnalyticsFilterState> & Record<string, unknown>): string {
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
