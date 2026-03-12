<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";

const authStore = useAuthStore();
const route = useRoute();

const navigation = computed(() => {
  const baseNav = [
    { name: "Dashboard", href: "/applicant/dashboard", icon: "home" },
  ];

  if (authStore.isApplicant) {
    return [
      ...baseNav,
      { name: "My Declarations", href: "/applicant/declarations", icon: "file-text" },
      { name: "New Declaration", href: "/applicant/declaration/new", icon: "plus-circle" },
    ];
  }

  if (authStore.isOfficer) {
    return [
      { name: "Dashboard", href: "/officer/dashboard", icon: "home" },
      { name: "Submissions", href: "/officer/submissions", icon: "inbox" },
      { name: "Reviews", href: "/officer/reviews", icon: "check-circle" },
      { name: "Receipts", href: "/officer/receipts", icon: "receipt" },
      { name: "Pickups", href: "/officer/pickups", icon: "package" },
    ];
  }

  if (authStore.isLegalUnit) {
    return [
      { name: "Dashboard", href: "/legal/dashboard", icon: "home" },
      { name: "Verify Code", href: "/legal/verify", icon: "search" },
    ];
  }

  if (authStore.isAdmin) {
    return [
      { name: "Dashboard", href: "/admin/dashboard", icon: "home" },
      { name: "Declarations", href: "/admin/declarations", icon: "file-text" },
      { name: "Users", href: "/admin/users", icon: "users" },
      { name: "Institutions", href: "/admin/institutions", icon: "building" },
      { name: "Audit Logs", href: "/admin/audit-logs", icon: "shield" },
      { name: "Reports", href: "/admin/reports", icon: "bar-chart" },
    ];
  }

  return baseNav;
});

const handleLogout = async () => {
  await authStore.logout();
  navigateTo("/auth/login");
};
</script>

<template>
  <div class="min-h-screen bg-muted/30">
    <!-- Top Navigation -->
    <header class="sticky top-0 z-50 bg-background border-b">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <!-- Logo -->
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <span class="text-primary-foreground font-bold">GH</span>
            </div>
            <span class="font-semibold text-foreground hidden sm:block">
              Asset Declaration Portal
            </span>
          </div>

          <!-- Navigation Links -->
          <nav class="hidden md:flex items-center gap-1">
            <NuxtLink
              v-for="item in navigation"
              :key="item.name"
              :to="item.href"
              class="px-3 py-2 text-sm font-medium rounded-md transition-colors"
              :class="[
                route.path === item.href || route.path.startsWith(item.href + '/')
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              ]"
            >
              {{ item.name }}
            </NuxtLink>
          </nav>

          <!-- User Menu -->
          <div class="flex items-center gap-4">
            <!-- Notifications -->
            <NuxtLink
              to="/notifications"
              class="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted"
            >
              <span class="sr-only">Notifications</span>
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </NuxtLink>

            <!-- Profile Dropdown -->
            <div class="relative">
              <button
                type="button"
                class="flex items-center gap-2 p-2 text-sm rounded-md hover:bg-muted"
              >
                <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span class="text-primary font-medium">
                    {{ authStore.user?.email?.charAt(0).toUpperCase() }}
                  </span>
                </div>
                <span class="hidden sm:block text-foreground">
                  {{ authStore.user?.email }}
                </span>
              </button>
            </div>

            <!-- Logout -->
            <button
              type="button"
              class="p-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted"
              @click="handleLogout"
            >
              <span class="sr-only">Logout</span>
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Mobile Navigation -->
      <nav class="md:hidden border-t px-4 py-2 flex gap-1 overflow-x-auto">
        <NuxtLink
          v-for="item in navigation"
          :key="item.name"
          :to="item.href"
          class="px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-colors"
          :class="[
            route.path === item.href || route.path.startsWith(item.href + '/')
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          ]"
        >
          {{ item.name }}
        </NuxtLink>
      </nav>
    </header>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <slot />
    </main>
  </div>
</template>
