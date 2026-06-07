import { useAuthStore } from "~/stores/auth";

export default defineNuxtRouteMiddleware(async (to) => {
  // Auth state lives in localStorage (see plugins/auth.ts) and is unreachable
  // during SSR, so this middleware runs on the client only — otherwise the
  // server would force-redirect every authenticated request to /auth/login.
  if (import.meta.server) return;

  const authStore = useAuthStore();

  // Initialize auth state
  await authStore.initialize();

  // On a hard reload the auth plugin rehydrates the tokens from localStorage
  // synchronously, but the user (and therefore the role flags) is only loaded
  // later in onNuxtReady — after this middleware has already run. Without the
  // roles, every `isAdmin`/`isOfficer`/… check below is false and the role
  // guards redirect to `dashboardPath`, which falls back to /applicant/dashboard
  // and then fails its own applicant check, producing an infinite redirect.
  // Load the user here so role decisions see real roles. (fetchUser clears the
  // tokens if the session is invalid, so isAuthenticated stays correct.)
  if (authStore.isAuthenticated && !authStore.user) {
    await authStore.fetchUser();
  }

  // Public routes that don't require authentication
  const publicRoutes = ["/", "/auth/login", "/auth/register", "/auth/forgot-password", "/auth/reset-password", "/auth/verify-email"];
  const isPublicRoute = publicRoutes.some((route) => to.path === route || to.path.startsWith(route + "/"));

  if (isPublicRoute) {
    // If user is already authenticated and trying to access auth pages, redirect to dashboard
    if (authStore.isAuthenticated && to.path.startsWith("/auth/")) {
      return navigateTo(authStore.dashboardPath);
    }
    return;
  }

  // Check if user is authenticated
  if (!authStore.isAuthenticated) {
    return navigateTo("/auth/login");
  }

  // Role-based access control
  const path = to.path;

  // On a role violation, send the user to THEIR own dashboard rather than
  // always the applicant one.
  if (path.startsWith("/admin") && !authStore.isAdmin) {
    return navigateTo(authStore.dashboardPath);
  }

  if (path.startsWith("/officer") && !authStore.isOfficer && !authStore.isAdmin) {
    return navigateTo(authStore.dashboardPath);
  }

  if (path.startsWith("/legal") && !authStore.isLegalUnit && !authStore.isAdmin) {
    return navigateTo(authStore.dashboardPath);
  }

  if (path.startsWith("/applicant") && !authStore.isApplicant && !authStore.isAdmin) {
    return navigateTo(authStore.dashboardPath);
  }
});
