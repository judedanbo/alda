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
   * Prepend a newly-arrived notification (pushed over SSE or poll) into the
   * local store and bump unreadCount. No-op if it's already present —
   * dedupes against concurrent fetches, which also guarantees a notification
   * delivered by *both* SSE and the poll fallback only ever toasts once.
   *
   * Pass `{ toast: true }` from live transports (SSE / poll) to raise a toast
   * for a genuinely-new unread notification. Initial/baseline loads use
   * `fetchNotifications` (which sets state directly) so they never toast.
   */
  function pushNotification(n: Notification, opts: { toast?: boolean } = {}) {
    if (notifications.value.some((existing) => existing.id === n.id)) return;
    notifications.value = [n, ...notifications.value];
    if (!n.readAt) unreadCount.value += 1;
    total.value += 1;

    if (opts.toast && !n.readAt) {
      const { toast } = useToast();
      toast.info(n.message, {
        title: n.title,
        action: { label: "View", onClick: () => { navigateTo("/notifications"); } },
      });
    }
  }

  /**
   * Poll fallback for the live bell — used when the SSE connection drops.
   * Fetches the most recent notifications, reconciles the unread count, and
   * toasts any that aren't already known (dedupe handles the overlap with SSE).
   */
  async function pollNew() {
    try {
      const response = await authFetch<{ success: boolean; data: { notifications: Notification[]; unreadCount: number } }>(
        "/api/notifications?limit=10",
      );
      if (!response.success) return;
      unreadCount.value = response.data.unreadCount;
      // oldest → newest so the resulting toast stack is in chronological order.
      for (const n of [...response.data.notifications].reverse()) {
        pushNotification(n, { toast: true });
      }
    } catch (error) {
      console.error("Failed to poll notifications:", error);
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
    pushNotification,
    pollNew,
  };
});
