import { authFetch } from "~/utils/authFetch";

export interface DashboardStatsResponse<T> {
  success: boolean;
  data: T;
}

export function useDashboardStats<T = unknown>(endpoint: string) {
  const data = ref<T | null>(null) as Ref<T | null>;
  const loading = ref(true);
  const error = ref<unknown>(null);

  async function refresh() {
    loading.value = true;
    error.value = null;
    try {
      const response = await authFetch<DashboardStatsResponse<T>>(endpoint);
      data.value = response.data;
    } catch (e) {
      error.value = e;
      console.error(`Failed to load dashboard stats from ${endpoint}:`, e);
    } finally {
      loading.value = false;
    }
  }

  onMounted(refresh);

  return { data, loading, error, refresh };
}
