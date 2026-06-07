<script setup lang="ts">
import type { NavItem } from "~/composables/useDashboardNav";
import { navIcon } from "./nav-icons";

defineProps<{
  item: NavItem;
  active: boolean;
  collapsed?: boolean;
}>();
</script>

<template>
  <NuxtLink
    :to="item.href"
    :data-tour="item.tour"
    :aria-current="active ? 'page' : undefined"
    class="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors"
    :class="[
      active
        ? 'bg-primary text-primary-foreground'
        : 'text-muted-foreground hover:text-foreground hover:bg-muted',
      collapsed ? 'justify-center' : '',
    ]"
  >
    <component :is="navIcon(item.icon)" class="w-5 h-5 shrink-0" aria-hidden="true" />
    <span v-if="!collapsed" class="truncate">{{ item.name }}</span>
    <span v-else class="sr-only">{{ item.name }}</span>
  </NuxtLink>
</template>
