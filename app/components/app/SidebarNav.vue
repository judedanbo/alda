<script setup lang="ts">
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-vue-next";
import type { NavItem } from "~/composables/useDashboardNav";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

const { navigation } = useDashboardNav();
const { collapsed, mobileOpen, toggleCollapsed, closeMobile } = useSidebar();
const route = useRoute();

const isActive = (item: NavItem) =>
  route.path === item.href || route.path.startsWith(item.href + "/");

// Close the mobile drawer whenever the route changes.
watch(() => route.path, () => closeMobile());
</script>

<template>
  <!-- Desktop sidebar -->
  <aside
    class="hidden md:flex flex-col sticky top-16 h-[calc(100vh-4rem)] shrink-0 border-r bg-background transition-[width] duration-200"
    :class="collapsed ? 'w-16' : 'w-60'"
  >
    <div
      class="border-b p-2 flex"
      :class="collapsed ? 'justify-center' : 'justify-end'"
    >
      <button
        type="button"
        :aria-label="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        :aria-expanded="!collapsed"
        class="flex items-center justify-center w-9 h-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        @click="toggleCollapsed"
      >
        <ChevronRightIcon v-if="collapsed" class="w-5 h-5 shrink-0" aria-hidden="true" />
        <ChevronLeftIcon v-else class="w-5 h-5 shrink-0" aria-hidden="true" />
      </button>
    </div>

    <nav
      class="flex-1 overflow-y-auto px-2 py-4 flex flex-col gap-1"
      aria-label="Primary"
    >
      <TooltipProvider :delay-duration="0">
        <template v-for="item in navigation" :key="item.name">
          <Tooltip v-if="collapsed">
            <TooltipTrigger as-child>
              <AppSidebarNavLink :item="item" :active="isActive(item)" collapsed />
            </TooltipTrigger>
            <TooltipContent side="right">{{ item.name }}</TooltipContent>
          </Tooltip>
          <AppSidebarNavLink v-else :item="item" :active="isActive(item)" />
        </template>
      </TooltipProvider>
    </nav>
  </aside>

  <!-- Mobile drawer -->
  <Sheet v-model:open="mobileOpen">
    <SheetContent side="left" class="w-64 p-0">
      <SheetHeader class="p-4 border-b text-left">
        <SheetTitle>Navigation</SheetTitle>
        <SheetDescription class="sr-only">Primary navigation menu</SheetDescription>
      </SheetHeader>
      <nav
        class="px-2 py-4 flex flex-col gap-1 overflow-y-auto"
        aria-label="Primary mobile"
      >
        <AppSidebarNavLink
          v-for="item in navigation"
          :key="item.name"
          :item="item"
          :active="isActive(item)"
          @click="closeMobile"
        />
      </nav>
    </SheetContent>
  </Sheet>
</template>
