import { useAuthStore } from "~/stores/auth";

export default defineNuxtRouteMiddleware(async (to) => {
  const authStore = useAuthStore();

  // Initialize auth state
  await authStore.initialize();

  // Public routes that don't require authentication
  const publicRoutes = ["/", "/auth/login", "/auth/register", "/auth/forgot-password", "/auth/reset-password"];
  const isPublicRoute = publicRoutes.some((route) => to.path === route || to.path.startsWith(route + "/"));

  if (isPublicRoute) {
    // If user is already authenticated and trying to access auth pages, redirect to dashboard
    if (authStore.isAuthenticated && to.path.startsWith("/auth/")) {
      if (authStore.isAdmin) {
        return navigateTo("/admin/dashboard");
      } else if (authStore.isOfficer) {
        return navigateTo("/officer/dashboard");
      } else if (authStore.isLegalUnit) {
        return navigateTo("/legal/dashboard");
      } else {
        return navigateTo("/applicant/dashboard");
      }
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
