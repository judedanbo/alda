import { authFetch } from "~/utils/authFetch";

interface ApiFetchOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, unknown>;
  headers?: Record<string, string>;
  immediate?: boolean;
}

interface ApiError {
  message: string;
  statusCode: number;
  fieldErrors?: Record<string, string[]>;
}

export function useApiFetch<T = unknown>(url: string | Ref<string>, options: ApiFetchOptions = {}) {
  const data = ref<T | null>(null) as Ref<T | null>;
  const error = ref<ApiError | null>(null);
  const pending = ref(false);

  const { immediate, ...fetchOptions } = options;

  async function execute() {
    error.value = null;
    pending.value = true;

    try {
      const result = await authFetch<T>(unref(url), fetchOptions);
      data.value = result as T;
      return result;
    } catch (e: unknown) {
      const err = e as { data?: { message?: string; data?: { fieldErrors?: Record<string, string[]> } }; message?: string; status?: number; statusCode?: number };
      error.value = {
        message: err.data?.message || err.message || "An unexpected error occurred",
        statusCode: err.status || err.statusCode || 500,
        fieldErrors: err.data?.data?.fieldErrors,
      };
    } finally {
      pending.value = false;
    }
    return null;
  }

  if (immediate !== false && fetchOptions.method === undefined) {
    execute();
  }

  return { data, error, pending, execute };
}
