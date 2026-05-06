import { watch } from "vue";
import { useAuthStore } from "~/stores/auth";
import type { User } from "~/stores/auth";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const COOKIE_OPTIONS = { maxAge: COOKIE_MAX_AGE, path: "/", sameSite: "lax" as const };

export default defineNuxtPlugin(() => {
  const authStore = useAuthStore();

  const accessTokenCookie = useCookie("adla_access_token", COOKIE_OPTIONS);
  const refreshTokenCookie = useCookie("adla_refresh_token", COOKIE_OPTIONS);
  const userCookie = useCookie<User | null>("adla_user", COOKIE_OPTIONS);

  if (accessTokenCookie.value && refreshTokenCookie.value) {
    authStore.setTokens({
      accessToken: accessTokenCookie.value,
      refreshToken: refreshTokenCookie.value,
    });

    if (userCookie.value) {
      const raw = userCookie.value;
      authStore.user = typeof raw === "string" ? JSON.parse(raw) : raw;
    }

    if (import.meta.client) {
      onNuxtReady(() => {
        authStore.fetchUser();
      });
    }
  }

  authStore.initialized = true;

  watch(
    () => authStore.tokens,
    (newTokens) => {
      if (newTokens) {
        accessTokenCookie.value = newTokens.accessToken;
        refreshTokenCookie.value = newTokens.refreshToken;
      } else {
        accessTokenCookie.value = null;
        refreshTokenCookie.value = null;
        userCookie.value = null;
      }
    },
  );

  watch(
    () => authStore.user,
    (newUser) => {
      userCookie.value = newUser ?? null;
    },
  );
});
