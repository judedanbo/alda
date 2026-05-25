<script setup lang="ts">
import { useNotificationStore } from "~/stores/notifications";

definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const notificationStore = useNotificationStore();
const { hasUnread, markAsRead, markAllAsRead } = useNotifications();

const showUnreadOnly = ref(false);
const currentPage = ref(1);
const limit = 20;

// Fetch notifications
const fetchNotifications = async () => {
  await notificationStore.fetchNotifications({
    limit,
    offset: (currentPage.value - 1) * limit,
    unreadOnly: showUnreadOnly.value,
  });
};

// Initial fetch
await fetchNotifications();

// Watch for filter changes
watch([showUnreadOnly, currentPage], fetchNotifications);

const formatDate = (date: string) => {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
};

const getNotificationIcon = (type: string) => {
  const icons: Record<string, string> = {
    UNIQUE_CODE_GENERATED: "M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z",
    SUBMISSION_RECORDED: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    REVIEW_APPROVED: "M5 13l4 4L19 7",
    REVIEW_REJECTED: "M6 18L18 6M6 6l12 12",
    RECEIPT_READY: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
    PICKUP_REMINDER: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
  };
  return icons[type] || "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z";
};

const handleMarkAsRead = async (notificationId: string) => {
  await markAsRead(notificationId);
};

const handleMarkAllAsRead = async () => {
  await markAllAsRead();
};

const totalPages = computed(() => Math.ceil(notificationStore.total / limit));
</script>

<template>
  <div class="max-w-3xl mx-auto">
    <!-- Header -->
    <PageHeader
      title="Notifications"
      :description="`${notificationStore.unreadCount} unread notification${notificationStore.unreadCount !== 1 ? 's' : ''}`"
    >
      <template #actions>
        <Button
          v-if="hasUnread"
          variant="outline"
          size="sm"
          @click="handleMarkAllAsRead"
        >
          Mark all as read
        </Button>
      </template>
    </PageHeader>

    <!-- Filters -->
    <div class="mb-6 flex items-center gap-2">
      <Switch
        :checked="showUnreadOnly"
        @update:checked="showUnreadOnly = $event"
      />
      <Label class="cursor-pointer" @click="showUnreadOnly = !showUnreadOnly">
        Show unread only
      </Label>
    </div>

    <!-- Loading -->
    <div v-if="notificationStore.loading" class="space-y-3">
      <div v-for="i in 4" :key="i" class="flex gap-4 p-4">
        <Skeleton class="w-10 h-10 rounded-full shrink-0" />
        <div class="flex-1 space-y-2">
          <Skeleton class="h-4 w-3/4" />
          <Skeleton class="h-3 w-full" />
          <Skeleton class="h-3 w-1/4" />
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <Card
      v-else-if="notificationStore.notifications.length === 0"
      class="py-12"
    >
      <CardContent class="text-center">
        <svg class="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        <h3 class="text-lg font-medium text-foreground mb-2">No notifications</h3>
        <p class="text-muted-foreground">
          {{ showUnreadOnly ? 'No unread notifications' : 'You\'re all caught up!' }}
        </p>
      </CardContent>
    </Card>

    <!-- Notifications List -->
    <div v-else class="space-y-2">
      <Card
        v-for="notification in notificationStore.notifications"
        :key="notification.id"
        :class="{ 'bg-primary/5 border-primary/20': !notification.readAt }"
      >
        <CardContent class="p-4">
          <div class="flex gap-4">
            <!-- Icon -->
            <div
              class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              :class="notification.readAt ? 'bg-muted' : 'bg-primary/10'"
            >
              <svg
                class="w-5 h-5"
                :class="notification.readAt ? 'text-muted-foreground' : 'text-primary'"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  :d="getNotificationIcon(notification.type)"
                />
              </svg>
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between gap-2">
                <div class="flex items-center gap-2">
                  <h3 class="font-medium text-foreground">
                    {{ notification.title }}
                  </h3>
                  <Badge v-if="!notification.readAt" variant="default" class="text-xs">
                    New
                  </Badge>
                </div>
                <time class="text-xs text-muted-foreground whitespace-nowrap">
                  {{ formatDate(notification.createdAt) }}
                </time>
              </div>
              <p class="text-sm text-muted-foreground mt-1">
                {{ notification.message }}
              </p>

              <!-- Actions -->
              <div v-if="!notification.readAt" class="mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  @click="handleMarkAsRead(notification.id)"
                >
                  Mark as read
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- Pagination -->
      <div
        v-if="totalPages > 1"
        class="flex items-center justify-center gap-2 mt-6 pt-6 border-t"
      >
        <Button
          variant="outline"
          size="sm"
          :disabled="currentPage <= 1"
          @click="currentPage--"
        >
          Previous
        </Button>
        <span class="text-sm text-muted-foreground">
          Page {{ currentPage }} of {{ totalPages }}
        </span>
        <Button
          variant="outline"
          size="sm"
          :disabled="currentPage >= totalPages"
          @click="currentPage++"
        >
          Next
        </Button>
      </div>
    </div>
  </div>
</template>
