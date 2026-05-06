import { useAuthStore } from "~/stores/auth";
import type { NitroFetchOptions } from "nitropack";

interface ApiFetchOptions extends NitroFetchOptions<string> {
  immediate?: boolean;
}

interface ApiError {
  message: string;
  statusCode: number;
  fieldErrors?: Record<string, string[]>;
}

export function useApiFetch<T = unknown>(url: string | Ref<string>, options: ApiFetchOptions = {}) {
  const authStore = useAuthStore();
  const data = ref<T | null>(null) as Ref<T | null>;
  const error = ref<ApiError | null>(null);
  const pending = ref(false);

  const { immediate, ...fetchOptions } = options;

  async function execute() {
    error.value = null;
    pending.value = true;

    const resolvedUrl = unref(url);

    try {
      const result = await $fetch<T>(resolvedUrl, {
        ...fetchOptions,
        headers: {
          ...authStore.getAuthHeaders(),
          ...(fetchOptions.headers as Record<string, string> || {}),
        },
      });
      data.value = result as T;
      return result;
    } catch (e: any) {
      if (e.status === 401 || e.statusCode === 401) {
        const refreshed = await authStore.refreshTokens();
        if (refreshed) {
          try {
            const result = await $fetch<T>(resolvedUrl, {
              ...fetchOptions,
              headers: {
                ...authStore.getAuthHeaders(),
                ...(fetchOptions.headers as Record<string, string> || {}),
              },
            });
            data.value = result as T;
            return result;
          } catch (retryError: any) {
            error.value = normalizeError(retryError);
          }
        } else {
          authStore.logout();
          navigateTo("/auth/login");
        }
      } else {
        error.value = normalizeError(e);
      }
    } finally {
      pending.value = false;
    }
    return null;
  }

  function normalizeError(e: any): ApiError {
    return {
      message: e.data?.message || e.message || "An unexpected error occurred",
      statusCode: e.status || e.statusCode || 500,
      fieldErrors: e.data?.data?.fieldErrors,
    };
  }

  if (immediate !== false && fetchOptions.method === undefined) {
    execute();
  }

  return { data, error, pending, execute };
}
