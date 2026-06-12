<script setup lang="ts">
import { CircleHelpIcon } from "lucide-vue-next";
import { useAuthStore } from "~/stores/auth";
import { useHelpStore } from "~/stores/help";
import { ROLE_LABELS, type RoleName } from "~/utils/roles";
import type { AcceptableValue } from "reka-ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

const authStore = useAuthStore();
const helpStore = useHelpStore();

const handleLogout = async () => {
  await authStore.logout();
  navigateTo("/auth/login");
};

const handleRoleSwitch = (role: AcceptableValue) => {
  if (typeof role !== "string" || role === authStore.effectiveRole) return;
  authStore.setActiveRole(role);
  navigateTo(authStore.dashboardPath);
};
</script>

<template>
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
          <template v-if="authStore.availableRoles.length > 1">
            <DropdownMenuLabel class="text-xs font-normal text-muted-foreground">Acting as</DropdownMenuLabel>
            <DropdownMenuRadioGroup :model-value="authStore.effectiveRole ?? undefined" @update:model-value="handleRoleSwitch">
              <DropdownMenuRadioItem v-for="role in authStore.availableRoles" :key="role" :value="role">
                {{ ROLE_LABELS[role as RoleName] }}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
          </template>
          <DropdownMenuItem as-child>
            <NuxtLink to="/account">My Account</NuxtLink>
          </DropdownMenuItem>
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
</template>
