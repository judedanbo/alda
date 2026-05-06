import { useNotificationStore } from "~/stores/notifications";

export function useNotifications() {
  const store = useNotificationStore();

  const notifications = computed(() => store.notifications);
  const unreadCount = computed(() => store.unreadCount);
  const hasUnread = computed(() => store.hasUnread);

  return {
    notifications,
    unreadCount,
    hasUnread,
    fetchNotifications: store.fetchNotifications,
    markAsRead: store.markAsRead,
    markAllAsRead: store.markAllAsRead,
    refreshUnreadCount: store.refreshUnreadCount,
  };
}
