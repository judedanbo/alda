<script setup lang="ts">
import { CircleHelpIcon } from "lucide-vue-next";
import { useAuthStore } from "~/stores/auth";
import { useHelpStore } from "~/stores/help";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

const authStore = useAuthStore();
const helpStore = useHelpStore();
const route = useRoute();
const { hasActiveDeclaration, check: checkActiveDeclaration } = useActiveDeclaration();

// Open a live SSE stream so the bell badge updates without reload.
// The composable manages the connection lifecycle; no-op on the server.
useNotificationStream();

onMounted(() => {
  if (authStore.isApplicant) {
    checkActiveDeclaration();
  }
});

const isDashboardRoute = computed(() => route.path.endsWith("/dashboard"));

interface NavItem {
  name: string;
  href: string;
  icon: string;
  tour?: string;
  disabled?: boolean;
}

const helpNavItem: NavItem = {
  name: "Help",
  href: "/help",
  icon: "circle-help",
  tour: "nav-help",
};

const navigation = computed<NavItem[]>(() => {
  const baseNav: NavItem[] = [
    { name: "Dashboard", href: "/applicant/dashboard", icon: "home", tour: "nav-dashboard" },
  ];

  if (authStore.isApplicant) {
    return [
      ...baseNav,
      { name: "My Declarations", href: "/applicant/declarations", icon: "file-text", tour: "nav-declarations" },
      { name: "New Declaration", href: "/applicant/declaration/new", icon: "plus-circle", tour: "nav-new-declaration", disabled: !authStore.isVerified || hasActiveDeclaration.value },
      { name: "Analytics", href: "/applicant/analytics", icon: "bar-chart", tour: "nav-analytics" },
      helpNavItem,
    ];
  }

  if (authStore.isOfficer) {
    return [
      { name: "Dashboard", href: "/officer/dashboard", icon: "home", tour: "nav-dashboard" },
      { name: "Form Returns", href: "/officer/form-returns", icon: "inbox", tour: "nav-form-returns" },
      { name: "Reviews", href: "/officer/reviews", icon: "check-circle", tour: "nav-reviews" },
      { name: "Receipts", href: "/officer/receipts", icon: "receipt", tour: "nav-receipts" },
      { name: "Compliance", href: "/officer/compliance", icon: "clipboard-check", tour: "nav-compliance" },
      { name: "Analytics", href: "/officer/analytics", icon: "bar-chart", tour: "nav-analytics" },
      helpNavItem,
    ];
  }

  if (authStore.isLegalUnit) {
    return [
      { name: "Dashboard", href: "/legal/dashboard", icon: "home", tour: "nav-dashboard" },
      { name: "Applicant Verifications", href: "/legal/verifications", icon: "user-check", tour: "nav-verifications" },
      { name: "Form Reissues", href: "/legal/form-reissues", icon: "file-text", tour: "nav-form-reissues" },
      { name: "Verify Code", href: "/legal/verify", icon: "search", tour: "nav-verify-code" },
      { name: "Compliance", href: "/legal/compliance", icon: "clipboard-check", tour: "nav-compliance" },
      { name: "Analytics", href: "/legal/analytics", icon: "bar-chart", tour: "nav-analytics" },
      helpNavItem,
    ];
  }

  if (authStore.isAdmin) {
    return [
      { name: "Dashboard", href: "/admin/dashboard", icon: "home", tour: "nav-dashboard" },
      { name: "Declarations", href: "/admin/declarations", icon: "file-text", tour: "nav-declarations" },
      { name: "Users", href: "/admin/users", icon: "users", tour: "nav-users" },
      { name: "Institutions", href: "/admin/institutions", icon: "building", tour: "nav-institutions" },
      { name: "Categories", href: "/admin/categories", icon: "tag", tour: "nav-categories" },
      { name: "Doc Templates", href: "/admin/document-templates", icon: "file-text", tour: "nav-doc-templates" },
      { name: "Audit Logs", href: "/admin/audit-logs", icon: "shield", tour: "nav-audit-logs" },
      { name: "Compliance", href: "/admin/compliance", icon: "clipboard-check", tour: "nav-compliance" },
      { name: "Analytics", href: "/admin/analytics", icon: "bar-chart", tour: "nav-analytics" },
      { name: "Web Analytics", href: "/admin/web-analytics", icon: "activity", tour: "nav-web-analytics" },
      { name: "Reports", href: "/admin/reports", icon: "bar-chart", tour: "nav-reports" },
      helpNavItem,
    ];
  }

  return [...baseNav, helpNavItem];
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
          <nav class="hidden md:flex items-center gap-1" aria-label="Primary">
            <template v-for="item in navigation" :key="item.name">
              <NuxtLink
                v-if="!item.disabled"
                :to="item.href"
                :data-tour="item.tour"
                class="px-3 py-2 text-sm font-medium rounded-md transition-colors"
                :class="[
                  route.path === item.href || route.path.startsWith(item.href + '/')
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                ]"
              >
                {{ item.name }}
              </NuxtLink>
              <a
                v-else
                href="#"
                role="link"
                aria-disabled="true"
                :data-tour="item.tour"
                class="px-3 py-2 text-sm font-medium rounded-md text-muted-foreground/50 cursor-not-allowed"
                :title="hasActiveDeclaration && item.href === '/applicant/declaration/new'
                  ? 'You have an active declaration in progress'
                  : 'Registration verification required'"
                @click.prevent
              >
                {{ item.name }}
              </a>
            </template>
          </nav>

          <!-- User Menu -->
          <div class="flex items-center gap-4">
            <!-- Contextual help -->
            <button
              type="button"
              data-tour="help-button"
              aria-label="Help for this page"
              class="flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              @click="helpStore.openContextual()"
            >
              <CircleHelpIcon class="w-5 h-5" />
            </button>

            <ClientOnly>
              <!-- Notifications -->
              <AppNotificationBell />

              <!-- Profile Dropdown -->
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <button class="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-muted">
                    <div class="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                      {{ (authStore.user?.fullName || authStore.user?.email)?.charAt(0).toUpperCase() }}
                    </div>
                    <span class="hidden md:inline text-sm text-foreground">{{ authStore.user?.fullName || authStore.user?.email }}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" class="w-56">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem as-child>
                    <NuxtLink to="/help">Help Centre</NuxtLink>
                  </DropdownMenuItem>
                  <DropdownMenuItem as-child>
                    <NuxtLink to="/settings/preferences">Settings</NuxtLink>
                  </DropdownMenuItem>
                  <AppThemeSwitcherMenu />
                  <DropdownMenuSeparator />
                  <DropdownMenuItem class="text-destructive" @click="handleLogout">
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
      <nav
        class="md:hidden border-t px-4 py-2 flex gap-1 overflow-x-auto"
        aria-label="Primary mobile"
      >
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
          <a
            v-else
            href="#"
            role="link"
            aria-disabled="true"
            class="px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap text-muted-foreground/50 cursor-not-allowed"
            :title="hasActiveDeclaration && item.href === '/applicant/declaration/new'
              ? 'You have an active declaration in progress'
              : 'Registration verification required'"
            @click.prevent
          >
            {{ item.name }}
          </a>
        </template>
      </nav>
    </header>

    <!-- Main Content -->
    <main
      id="main-content"
      tabindex="-1"
      class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
    >
      <ClientOnly>
        <HelpOnboarding v-if="isDashboardRoute" />
      </ClientOnly>
      <slot />
    </main>

    <!-- Contextual help panel -->
    <HelpSheet />
  </div>
</template>
