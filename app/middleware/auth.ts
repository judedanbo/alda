import { useAuthStore } from "~/stores/auth";

export default defineNuxtRouteMiddleware(async (to) => {
  // Auth state lives in localStorage (see plugins/auth.ts) and is unreachable
  // during SSR, so this middleware runs on the client only — otherwise the
  // server would force-redirect every authenticated request to /auth/login.
  if (import.meta.server) return;

  const authStore = useAuthStore();

  // Initialize auth state
  await authStore.initialize();

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

  if (path.startsWith("/admin") && !authStore.isAdmin) {
    return navigateTo("/applicant/dashboard");
  }

  if (path.startsWith("/officer") && !authStore.isOfficer && !authStore.isAdmin) {
    return navigateTo("/applicant/dashboard");
  }

  if (path.startsWith("/legal") && !authStore.isLegalUnit && !authStore.isAdmin) {
    return navigateTo("/applicant/dashboard");
  }
});
