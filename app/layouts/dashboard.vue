<script setup lang="ts">
import { MenuIcon } from "lucide-vue-next";
import { useAuthStore } from "~/stores/auth";

const authStore = useAuthStore();
const route = useRoute();
const { hasActiveDeclaration, check: checkActiveDeclaration } = useActiveDeclaration();
const { navigation } = useDashboardNav();
const { toggleMobile } = useSidebar();

// Open a live SSE stream so the bell badge updates without reload.
// The composable manages the connection lifecycle; no-op on the server.
useNotificationStream();

onMounted(() => {
  if (authStore.isApplicant) {
    checkActiveDeclaration();
  }
});

const isDashboardRoute = computed(() => route.path.endsWith("/dashboard"));

const isActive = (href: string) =>
  route.path === href || route.path.startsWith(href + "/");
</script>

<template>
  <div class="min-h-screen bg-muted/30">
    <!-- Top bar (full-width for sidebar roles, centred for applicants) -->
    <header class="sticky top-0 z-50 bg-background border-b">
      <div
        class="px-4 sm:px-6 lg:px-8"
        :class="authStore.isApplicant ? 'max-w-7xl mx-auto' : ''"
      >
        <div class="flex items-center justify-between h-16">
          <!-- Logo (+ mobile drawer toggle for sidebar roles) -->
          <div class="flex items-center gap-2">
            <button
              v-if="!authStore.isApplicant"
              type="button"
              class="md:hidden flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Open navigation menu"
              @click="toggleMobile()"
            >
              <MenuIcon class="w-5 h-5" />
            </button>
            <AppBrandLogo
              :to="authStore.isAuthenticated ? authStore.dashboardPath : '/'"
              size="sm"
              show-wordmark
            />
          </div>

          <!-- Applicant desktop nav (sidebar roles use the left sidebar instead) -->
          <nav
            v-if="authStore.isApplicant"
            class="hidden md:flex items-center gap-1"
            aria-label="Primary"
          >
            <template v-for="item in navigation" :key="item.name">
              <NuxtLink
                v-if="!item.disabled"
                :to="item.href"
                :data-tour="item.tour"
                class="px-3 py-2 text-sm font-medium rounded-md transition-colors"
                :class="[
                  isActive(item.href)
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

          <!-- Help, notifications, avatar (all roles) -->
          <AppHeaderActions />
        </div>
      </div>

      <!-- Applicant mobile nav -->
      <nav
        v-if="authStore.isApplicant"
        class="md:hidden border-t px-4 py-2 flex gap-1 overflow-x-auto"
        aria-label="Primary mobile"
      >
        <template v-for="item in navigation" :key="item.name">
          <NuxtLink
            v-if="!item.disabled"
            :to="item.href"
            class="px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-colors"
            :class="[
              isActive(item.href)
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

    <!-- Applicant body -->
    <main
      v-if="authStore.isApplicant"
      id="main-content"
      tabindex="-1"
      class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
    >
      <ClientOnly>
        <HelpOnboarding v-if="isDashboardRoute" />
      </ClientOnly>
      <slot />
    </main>

    <!-- Sidebar roles (officer / legal / admin) body -->
    <div v-else class="flex">
      <AppSidebarNav />
      <main
        id="main-content"
        tabindex="-1"
        class="flex-1 min-w-0"
      >
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ClientOnly>
            <HelpOnboarding v-if="isDashboardRoute" />
          </ClientOnly>
          <slot />
        </div>
      </main>
    </div>

    <!-- Contextual help panel -->
    <HelpSheet />
  </div>
</template>
