import { watch } from "vue";
import { useAuthStore } from "~/stores/auth";

/**
 * Bootstraps the Pinia auth store from `localStorage` on the client.
 *
 * Tokens are deliberately NOT mirrored into cookies. Cookies without
 * `HttpOnly` are reachable from any script in the page (markdown renderers,
 * v-html paths, third-party widgets), and the server never reads cookies for
 * auth — it only honors `Authorization: Bearer …` (server/utils/jwt.ts).
 * localStorage has the same XSS surface as a non-HttpOnly cookie but doesn't
 * add a second copy of the secret, and the server stays cookie-free.
 *
 * The trade-off: SSR has no way to see the token, so authenticated pages
 * render their unauthenticated state on the server for one tick before the
 * client hydrates from localStorage. The client route middleware
 * (`app/middleware/auth.ts`) is gated on `import.meta.client` to avoid
 * force-redirecting those SSR passes to `/auth/login`.
 */
const STORAGE_KEY = "adla_tokens";
const ROLE_KEY = "adla_active_role";

function readStoredTokens(): { accessToken: string; refreshToken: string } | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed
      && typeof parsed.accessToken === "string"
      && typeof parsed.refreshToken === "string"
    ) {
      return { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken };
    }
    return null;
  } catch {
    // Corrupt payload, or storage access denied (Safari private mode, some
    // Firefox configurations). Treat as logged out.
    return null;
  }
}

export default defineNuxtPlugin(() => {
  const authStore = useAuthStore();

  if (import.meta.client) {
    const stored = readStoredTokens();
    if (stored) authStore.setTokens(stored);

    // Restore the chosen active role. Validity (still held by the user) is
    // enforced by the store's `effectiveRole`, so we can set it eagerly.
    try {
      const storedRole = window.localStorage.getItem(ROLE_KEY);
      if (storedRole) authStore.activeRole = storedRole;
    } catch {
      // Storage unavailable — fall back to precedence default.
    }
  }

  authStore.initialized = true;

  if (import.meta.client) {
    onNuxtReady(() => {
      if (authStore.tokens) authStore.fetchUser();
    });

    watch(
      () => authStore.tokens,
      (newTokens) => {
        try {
          if (newTokens) {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(newTokens));
          } else {
            window.localStorage.removeItem(STORAGE_KEY);
          }
        } catch {
          // Storage unavailable — degrade to in-memory; user re-logs on reload.
        }
      },
    );

    watch(
      () => authStore.activeRole,
      (role) => {
        try {
          if (role) {
            window.localStorage.setItem(ROLE_KEY, role);
          } else {
            window.localStorage.removeItem(ROLE_KEY);
          }
        } catch {
          // Storage unavailable — degrade to in-memory.
        }
      },
    );
  }
});
