import { useAuthStore } from "~/stores/auth";

let refreshPromise: Promise<boolean> | null = null;

function refreshTokenOnce(authStore: ReturnType<typeof useAuthStore>): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = authStore.refreshTokens().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

interface AuthFetchOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, unknown>;
  headers?: Record<string, string>;
}

const rawFetch = $fetch as (url: string, options?: AuthFetchOptions) => Promise<unknown>;

export async function authFetch<T = unknown>(
  url: string,
  options: AuthFetchOptions = {},
): Promise<T> {
  const authStore = useAuthStore();

  const buildOptions = (): AuthFetchOptions => ({
    ...options,
    headers: {
      ...authStore.getAuthHeaders(),
      ...(options.headers || {}),
    },
  });

  try {
    return (await rawFetch(url, buildOptions())) as T;
  } catch (error: unknown) {
    const status =
      (error as { status?: number }).status ??
      (error as { statusCode?: number }).statusCode;

    if (status === 401) {
      const refreshed = await refreshTokenOnce(authStore);
      if (refreshed) {
        return (await rawFetch(url, buildOptions())) as T;
      }
      await authStore.logout();
      await navigateTo("/auth/login");
    }
    throw error;
  }
}
