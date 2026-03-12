import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useAuthStore } from "./auth";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export const useNotificationStore = defineStore("notifications", () => {
  // State
  const notifications = ref<Notification[]>([]);
  const unreadCount = ref(0);
  const total = ref(0);
  const loading = ref(false);

  // Getters
  const hasUnread = computed(() => unreadCount.value > 0);
  const recentNotifications = computed(() => notifications.value.slice(0, 5));

  // Actions
  async function fetchNotifications(options: { limit?: number; offset?: number; unreadOnly?: boolean } = {}) {
    const authStore = useAuthStore();
    if (!authStore.isAuthenticated) return;

    loading.value = true;
    try {
      const query = new URLSearchParams();
      if (options.limit) query.set("limit", String(options.limit));
      if (options.offset) query.set("offset", String(options.offset));
      if (options.unreadOnly) query.set("unreadOnly", "true");

      const response = await $fetch(`/api/notifications?${query}`, {
        headers: authStore.getAuthHeaders(),
      });

      if (response.success) {
        notifications.value = response.data.notifications;
        unreadCount.value = response.data.unreadCount;
        total.value = response.data.total;
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      loading.value = false;
    }
  }

  async function markAsRead(notificationId: string) {
    const authStore = useAuthStore();
    if (!authStore.isAuthenticated) return;

    try {
      await $fetch(`/api/notifications/${notificationId}/read`, {
        method: "PATCH",
        headers: authStore.getAuthHeaders(),
      });

      // Update local state
      const notification = notifications.value.find((n) => n.id === notificationId);
      if (notification && !notification.readAt) {
        notification.readAt = new Date().toISOString();
        unreadCount.value = Math.max(0, unreadCount.value - 1);
      }
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  }

  async function markAllAsRead() {
    const authStore = useAuthStore();
    if (!authStore.isAuthenticated) return;

    try {
      await $fetch("/api/notifications/read-all", {
        method: "POST",
        headers: authStore.getAuthHeaders(),
      });

      // Update local state
      notifications.value.forEach((n) => {
        if (!n.readAt) {
          n.readAt = new Date().toISOString();
        }
      });
      unreadCount.value = 0;
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  }

  async function refreshUnreadCount() {
    const authStore = useAuthStore();
    if (!authStore.isAuthenticated) return;

    try {
      const response = await $fetch("/api/notifications?limit=1", {
        headers: authStore.getAuthHeaders(),
      });

      if (response.success) {
        unreadCount.value = response.data.unreadCount;
      }
    } catch (error) {
      console.error("Failed to fetch unread count:", error);
    }
  }

  return {
    // State
    notifications,
    unreadCount,
    total,
    loading,
    // Getters
    hasUnread,
    recentNotifications,
    // Actions
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    refreshUnreadCount,
  };
});
