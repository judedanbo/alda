import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { authFetch } from "~/utils/authFetch";

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
    loading.value = true;
    try {
      const query = new URLSearchParams();
      if (options.limit) query.set("limit", String(options.limit));
      if (options.offset) query.set("offset", String(options.offset));
      if (options.unreadOnly) query.set("unreadOnly", "true");

      const response = await authFetch<{ success: boolean; data: { notifications: Notification[]; unreadCount: number; total: number } }>(
        `/api/notifications?${query}`,
      );

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
    try {
      await authFetch(`/api/notifications/${notificationId}/read`, {
        method: "PATCH",
      });

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
    try {
      await authFetch("/api/notifications/read-all", {
        method: "POST",
      });

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
    try {
      const response = await authFetch<{ success: boolean; data: { unreadCount: number } }>(
        "/api/notifications?limit=1",
      );

      if (response.success) {
        unreadCount.value = response.data.unreadCount;
      }
    } catch (error) {
      console.error("Failed to fetch unread count:", error);
    }
  }

  /**
   * Prepend a newly-arrived notification (pushed over SSE) into the
   * local store and bump unreadCount. No-op if it's already present —
   * dedupes against concurrent fetches.
   */
  function pushNotification(n: Notification) {
    if (notifications.value.some((existing) => existing.id === n.id)) return;
    notifications.value = [n, ...notifications.value];
    if (!n.readAt) unreadCount.value += 1;
    total.value += 1;
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
    pushNotification,
  };
});
