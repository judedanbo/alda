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
