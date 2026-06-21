import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { ROLE_ORDER, ROLE_DASHBOARDS } from "~/utils/roles";

export interface User {
  id: string;
  email: string;
  phone: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  phoneVerifiedAt: string | null;
  roles: string[];
  hasProfile?: boolean;
  fullName?: string | null;
  verificationStatus?: string;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export const useAuthStore = defineStore("auth", () => {
  // State
  const user = ref<User | null>(null);
  const tokens = ref<Tokens | null>(null);
  const loading = ref(false);
  const initialized = ref(false);
  // The user's explicit, persisted role selection (see plugins/auth.ts). May be
  // null (never chosen) or stale/invalid (roles changed since); `effectiveRole`
  // validates it, so always read scoping decisions through that, not this.
  const activeRole = ref<string | null>(null);

  // Getters
  const isAuthenticated = computed(() => !!tokens.value?.accessToken);

  // Roles the user actually holds, ordered by precedence. The first entry is the
  // default "act as" role when none has been explicitly chosen.
  const availableRoles = computed(() => ROLE_ORDER.filter((r) => user.value?.roles.includes(r)));

  // The role currently in effect. Falls back to the highest-precedence available
  // role so behaviour matches the old fixed-precedence redirects before the user
  // ever touches the switcher.
  const effectiveRole = computed(() => {
    if (activeRole.value && availableRoles.value.includes(activeRole.value as (typeof ROLE_ORDER)[number])) {
      return activeRole.value;
    }
    return availableRoles.value[0] ?? null;
  });

  // Role flags reflect the ACTIVE role, not merely which roles are held. This is
  // what makes scoping strict: a multi-role user "acting as" one role sees the
  // nav, dashboard, and route access of only that role (the route middleware and
  // useDashboardNav both key off these flags).
  const isApplicant = computed(() => effectiveRole.value === "applicant");
  const isOfficer = computed(() => effectiveRole.value === "schedule_officer");
  const isLegalUnit = computed(() => effectiveRole.value === "legal_unit");
  const isAdmin = computed(() => effectiveRole.value === "admin");
  const isEmailVerified = computed(() => user.value?.emailVerified ?? false);
  const isPhoneVerified = computed(() => user.value?.phoneVerified ?? false);
  const isVerified = computed(() => user.value?.verificationStatus === "VERIFIED");

  // Single source of truth for "where does this user's dashboard live?".
  // Follows the active role so switching lands the user in the right shell.
  const dashboardPath = computed(() => ROLE_DASHBOARDS[(effectiveRole.value as (typeof ROLE_ORDER)[number]) ?? "applicant"]);

  function setActiveRole(role: string) {
    if (availableRoles.value.includes(role as (typeof ROLE_ORDER)[number])) {
      activeRole.value = role;
    }
  }

  // Actions
  function setTokens(newTokens: Tokens) {
    tokens.value = newTokens;
  }

  function clearTokens() {
    tokens.value = null;
  }

  async function initialize() {
    if (initialized.value) return;
    initialized.value = true;
  }

  async function register(email: string, password: string, phone?: string) {
    loading.value = true;
    try {
      const response = await $fetch("/api/auth/register", {
        method: "POST",
        body: { email, password, phone },
      });

      if (response.success) {
        user.value = response.data.user;
        setTokens(response.data.tokens);
        return { success: true };
      }

      return { success: false, error: "Registration failed" };
    } catch (error: unknown) {
      const e = error as { data?: { message?: string; data?: { fieldErrors?: Record<string, string[]> } } };
      return {
        success: false,
        error: e.data?.message || "Registration failed",
        fieldErrors: e.data?.data?.fieldErrors,
      };
    } finally {
      loading.value = false;
    }
  }

  async function login(email: string, password: string) {
    loading.value = true;
    try {
      const response = await $fetch("/api/auth/login", {
        method: "POST",
        body: { email, password },
      });

      if (response.success) {
        user.value = response.data.user;
        setTokens(response.data.tokens);
        return { success: true, hasProfile: response.data.user.hasProfile };
      }

      return { success: false, error: "Login failed" };
    } catch (error: unknown) {
      const e = error as { data?: { message?: string; data?: { fieldErrors?: Record<string, string[]> } } };
      return {
        success: false,
        error: e.data?.message || "Login failed",
        fieldErrors: e.data?.data?.fieldErrors,
      };
    } finally {
      loading.value = false;
    }
  }

  async function logout() {
    try {
      if (tokens.value?.accessToken) {
        await $fetch("/api/auth/logout", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokens.value.accessToken}`,
          },
        });
      }
    } catch {
      // Ignore errors on logout
    } finally {
      user.value = null;
      activeRole.value = null;
      clearTokens();
    }
  }

  async function refreshTokens() {
    if (!tokens.value?.refreshToken) {
      throw new Error("No refresh token available");
    }

    try {
      const response = await $fetch("/api/auth/refresh", {
        method: "POST",
        body: { refreshToken: tokens.value.refreshToken },
      });

      if (response.success) {
        setTokens(response.data.tokens);
        return true;
      }

      return false;
    } catch {
      clearTokens();
      user.value = null;
      return false;
    }
  }

  async function fetchUser() {
    if (!tokens.value?.accessToken) return;

    try {
      const response = await $fetch("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${tokens.value.accessToken}`,
        },
      });

      if (response.success) {
        user.value = {
          id: response.data.id,
          email: response.data.email,
          phone: response.data.phone,
          emailVerified: response.data.emailVerified,
          phoneVerified: response.data.phoneVerified ?? false,
          phoneVerifiedAt: response.data.phoneVerifiedAt ?? null,
          roles: response.data.roles,
          hasProfile: !!response.data.profile,
          fullName: response.data.profile?.fullName,
          verificationStatus: response.data.profile?.verificationStatus,
        };
      }
    } catch (error: unknown) {
      const e = error as { statusCode?: number };
      if (e.statusCode === 401) {
        const refreshed = await refreshTokens();
        if (refreshed) {
          await fetchUser();
        }
      }
    }
  }

  async function forgotPassword(email: string) {
    loading.value = true;
    try {
      const response = await $fetch("/api/auth/forgot-password", {
        method: "POST",
        body: { email },
      });

      return { success: true, message: response.message };
    } catch (error: unknown) {
      const e = error as { data?: { message?: string } };
      return {
        success: false,
        error: e.data?.message || "Failed to send reset email",
      };
    } finally {
      loading.value = false;
    }
  }

  async function resetPassword(token: string, password: string) {
    loading.value = true;
    try {
      const response = await $fetch("/api/auth/reset-password", {
        method: "POST",
        body: { token, password },
      });

      return { success: true, message: response.message };
    } catch (error: unknown) {
      const e = error as { data?: { message?: string } };
      return {
        success: false,
        error: e.data?.message || "Failed to reset password",
      };
    } finally {
      loading.value = false;
    }
  }

  async function sendPhoneCode() {
    if (!tokens.value?.accessToken) {
      return { success: false, error: "Not authenticated" };
    }
    try {
      const response = await $fetch("/api/auth/send-phone-code", {
        method: "POST",
        headers: { Authorization: `Bearer ${tokens.value.accessToken}` },
      });
      return {
        success: true,
        message: response.message,
        expiresAt: response.data?.expiresAt as string | undefined,
      };
    } catch (error: unknown) {
      const e = error as { data?: { message?: string; data?: { retryInSec?: number } }; statusCode?: number };
      return {
        success: false,
        error: e.data?.message || "Failed to send code",
        retryInSec: e.data?.data?.retryInSec,
      };
    }
  }

  async function verifyPhone(code: string) {
    if (!tokens.value?.accessToken) {
      return { success: false, error: "Not authenticated" };
    }
    try {
      await $fetch("/api/auth/verify-phone", {
        method: "POST",
        headers: { Authorization: `Bearer ${tokens.value.accessToken}` },
        body: { code },
      });
      await fetchUser();
      return { success: true };
    } catch (error: unknown) {
      const e = error as { data?: { message?: string } };
      return { success: false, error: e.data?.message || "Verification failed" };
    }
  }

  function getAuthHeaders(): Record<string, string> {
    if (!tokens.value?.accessToken) return {};
    return {
      Authorization: `Bearer ${tokens.value.accessToken}`,
    };
  }

  return {
    // State
    user,
    tokens,
    loading,
    initialized,
    activeRole,
    // Getters
    isAuthenticated,
    availableRoles,
    effectiveRole,
    isApplicant,
    isOfficer,
    isLegalUnit,
    isAdmin,
    isEmailVerified,
    isPhoneVerified,
    isVerified,
    dashboardPath,
    // Actions
    setActiveRole,
    setTokens,
    clearTokens,
    initialize,
    register,
    login,
    logout,
    refreshTokens,
    fetchUser,
    forgotPassword,
    resetPassword,
    sendPhoneCode,
    verifyPhone,
    getAuthHeaders,
  };
});
