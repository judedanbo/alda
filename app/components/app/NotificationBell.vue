<script setup lang="ts">
const { unreadCount, refreshUnreadCount } = useNotifications();

onMounted(() => {
  refreshUnreadCount();
});

const accessibleLabel = computed(() => {
  if (unreadCount.value === 0) return "Notifications";
  if (unreadCount.value === 1) return "Notifications, 1 unread";
  return `Notifications, ${unreadCount.value} unread`;
});
</script>

<template>
  <NuxtLink
    to="/notifications"
    :aria-label="accessibleLabel"
    class="relative p-2 text-muted-foreground hover:text-foreground"
  >
    <svg
      class="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
    <span
      v-if="unreadCount > 0"
      aria-hidden="true"
      class="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 font-medium"
    >
      {{ unreadCount > 99 ? "99+" : unreadCount }}
    </span>
  </NuxtLink>
</template>
