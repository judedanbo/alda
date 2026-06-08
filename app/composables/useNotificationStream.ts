/**
 * Opens (and keeps open) a Server-Sent Events stream to
 * /api/notifications/stream so new in-app notifications appear without
 * reload. Reconnects with exponential backoff on disconnect.
 *
 * Mount once at the dashboard layout level. The bell/list components
 * read from the notifications store as usual.
 */
import { useIntervalFn } from "@vueuse/core";
import { useAuthStore } from "~/stores/auth";
import { useNotificationStore } from "~/stores/notifications";

/** Fallback poll cadence used when the SSE connection is unavailable. */
const POLL_INTERVAL_MS = 30_000;

interface NotificationEvent {
  type: "notification.created";
  notificationId: string;
  title: string;
  message: string;
  notificationType: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

const MAX_BACKOFF_MS = 30_000;

export function useNotificationStream() {
  if (!import.meta.client) {
    return { stop: () => {} };
  }

  const auth = useAuthStore();
  const notifications = useNotificationStore();

  let source: EventSource | null = null;
  let backoff = 1000;
  let stopped = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function connect() {
    if (stopped) return;
    const token = auth.tokens?.accessToken;
    if (!token) {
      // No token yet — try again shortly. The auth store fills this in
      // after login / token refresh.
      reconnectTimer = setTimeout(connect, 2000);
      return;
    }

    source = new EventSource(`/api/notifications/stream?token=${encodeURIComponent(token)}`);

    source.addEventListener("ready", () => {
      // Successful handshake — reset backoff.
      backoff = 1000;
    });

    source.addEventListener("notification", (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as NotificationEvent;
        notifications.pushNotification(
          {
            id: data.notificationId,
            type: data.notificationType,
            title: data.title,
            message: data.message,
            metadata: data.metadata ?? null,
            readAt: null,
            createdAt: data.createdAt,
          },
          { toast: true },
        );
      } catch (err) {
        console.error("[notification-stream] failed to parse event", err);
      }
    });

    source.onerror = () => {
      // Browsers retry EventSource automatically, but we close + reopen
      // so a refreshed token gets picked up on the next attempt.
      source?.close();
      source = null;
      if (stopped) return;
      backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
      reconnectTimer = setTimeout(connect, backoff);
    };
  }

  function stop() {
    stopped = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    source?.close();
    source = null;
  }

  // 30s poll fallback. SSE is primary (instant); this catches notifications
  // missed while the EventSource was disconnected, and self-heals the badge
  // count. Dedupe in the store means overlap with SSE never double-toasts.
  const { pause: pausePoll, resume: resumePoll } = useIntervalFn(
    () => notifications.pollNew(),
    POLL_INTERVAL_MS,
    { immediate: false },
  );

  // Auto-start on mount; cleanup on unmount.
  onMounted(async () => {
    // Seed a baseline so pre-existing unread notifications are never toasted
    // as "new" by the first poll tick (pushNotification dedupes by id).
    await notifications.fetchNotifications({ limit: 20 });
    connect();
    resumePoll();
  });
  onBeforeUnmount(() => {
    pausePoll();
    stop();
  });

  return { stop };
}
