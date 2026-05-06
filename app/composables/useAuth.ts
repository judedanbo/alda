import { useAuthStore } from "~/stores/auth";

export function useAuth() {
  const store = useAuthStore();

  const user = computed(() => store.user);
  const isAuthenticated = computed(() => store.isAuthenticated);
  const isEmailVerified = computed(() => store.user?.emailVerified ?? false);
  const isApplicant = computed(() => store.isApplicant);
  const isOfficer = computed(() => store.isOfficer);
  const isLegalUnit = computed(() => store.isLegalUnit);
  const isAdmin = computed(() => store.isAdmin);

  return {
    user,
    isAuthenticated,
    isEmailVerified,
    isApplicant,
    isOfficer,
    isLegalUnit,
    isAdmin,
    login: store.login,
    logout: store.logout,
    register: store.register,
  };
}
