<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

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
      { name: "New Declaration", href: "/applicant/declaration/new", icon: "plus-circle", disabled: !authStore.isVerified },
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
      { name: "Applicant Verifications", href: "/legal/verifications", icon: "user-check" },
      { name: "Verify Code", href: "/legal/verify", icon: "search" },
    ];
  }

  if (authStore.isAdmin) {
    return [
      { name: "Dashboard", href: "/admin/dashboard", icon: "home" },
      { name: "Declarations", href: "/admin/declarations", icon: "file-text" },
      { name: "Users", href: "/admin/users", icon: "users" },
      { name: "Institutions", href: "/admin/institutions", icon: "building" },
      { name: "Categories", href: "/admin/categories", icon: "tag" },
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
            <template v-for="item in navigation" :key="item.name">
              <NuxtLink
                v-if="!item.disabled"
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
              <span
                v-else
                class="px-3 py-2 text-sm font-medium rounded-md text-muted-foreground/50 cursor-not-allowed"
                :title="'Registration verification required'"
              >
                {{ item.name }}
              </span>
            </template>
          </nav>

          <!-- User Menu -->
          <div class="flex items-center gap-4">
            <ClientOnly>
              <!-- Notifications -->
              <AppNotificationBell />

              <!-- Profile Dropdown -->
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <button class="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-muted">
                    <div class="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                      {{ authStore.user?.email?.charAt(0).toUpperCase() }}
                    </div>
                    <span class="hidden md:inline text-sm text-foreground">{{ authStore.user?.email }}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" class="w-56">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem as-child>
                    <NuxtLink to="/settings/preferences">Settings</NuxtLink>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem @click="handleLogout" class="text-destructive">
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <template #fallback>
                <div class="flex items-center gap-2 px-3 py-1.5">
                  <div class="w-8 h-8 bg-muted rounded-full animate-pulse" />
                  <div class="hidden md:block w-24 h-4 bg-muted rounded animate-pulse" />
                </div>
              </template>
            </ClientOnly>
          </div>
        </div>
      </div>

      <!-- Mobile Navigation -->
      <nav class="md:hidden border-t px-4 py-2 flex gap-1 overflow-x-auto">
        <template v-for="item in navigation" :key="item.name">
          <NuxtLink
            v-if="!item.disabled"
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
          <span
            v-else
            class="px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap text-muted-foreground/50 cursor-not-allowed"
            :title="'Registration verification required'"
          >
            {{ item.name }}
          </span>
        </template>
      </nav>
    </header>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <slot />
    </main>
  </div>
</template>
