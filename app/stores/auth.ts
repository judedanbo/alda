import { defineStore } from "pinia";
import { ref, computed } from "vue";

interface User {
  id: string;
  email: string;
  phone: string | null;
  emailVerified: boolean;
  roles: string[];
  hasProfile?: boolean;
}

interface Tokens {
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

  // Actions
  function setTokens(newTokens: Tokens) {
    tokens.value = newTokens;
    if (import.meta.client) {
      localStorage.setItem("adla_tokens", JSON.stringify(newTokens));
    }
  }

  function clearTokens() {
    tokens.value = null;
    if (import.meta.client) {
      localStorage.removeItem("adla_tokens");
    }
  }

  async function initialize() {
    if (initialized.value) return;

    if (import.meta.client) {
      const stored = localStorage.getItem("adla_tokens");
      if (stored) {
        try {
          tokens.value = JSON.parse(stored);
          await fetchUser();
        } catch {
          clearTokens();
        }
      }
    }
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
    } catch (error: any) {
      return {
        success: false,
        error: error.data?.message || "Registration failed",
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
    } catch (error: any) {
      return {
        success: false,
        error: error.data?.message || "Login failed",
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
          roles: response.data.roles,
          hasProfile: !!response.data.profile,
        };
      }
    } catch (error: any) {
      if (error.statusCode === 401) {
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
    } catch (error: any) {
      return {
        success: false,
        error: error.data?.message || "Failed to send reset email",
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
    } catch (error: any) {
      return {
        success: false,
        error: error.data?.message || "Failed to reset password",
      };
    } finally {
      loading.value = false;
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
    getAuthHeaders,
  };
});
