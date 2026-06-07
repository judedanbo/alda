import { defineStore } from "pinia";
import { ref, computed } from "vue";

export interface User {
  id: string;
  email: string;
  phone: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  phoneVerifiedAt: string | null;
  roles: string[];
  hasProfile?: boolean;
  fullName?: string;
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

  // Getters
  const isAuthenticated = computed(() => !!tokens.value?.accessToken);
  const isApplicant = computed(() => user.value?.roles.includes("applicant") ?? false);
  const isOfficer = computed(() => user.value?.roles.includes("schedule_officer") ?? false);
  const isLegalUnit = computed(() => user.value?.roles.includes("legal_unit") ?? false);
  const isAdmin = computed(() => user.value?.roles.includes("admin") ?? false);
  const isEmailVerified = computed(() => user.value?.emailVerified ?? false);
  const isPhoneVerified = computed(() => user.value?.phoneVerified ?? false);
  const isVerified = computed(() => user.value?.verificationStatus === "VERIFIED");

  // Single source of truth for "where does this user's dashboard live?".
  // Precedence matches the role-based redirects in middleware/auth.ts.
  const dashboardPath = computed(() => {
    if (isAdmin.value) return "/admin/dashboard";
    if (isOfficer.value) return "/officer/dashboard";
    if (isLegalUnit.value) return "/legal/dashboard";
    return "/applicant/dashboard";
  });

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
    // Getters
    isAuthenticated,
    isApplicant,
    isOfficer,
    isLegalUnit,
    isAdmin,
    isEmailVerified,
    isPhoneVerified,
    isVerified,
    dashboardPath,
    // Actions
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
