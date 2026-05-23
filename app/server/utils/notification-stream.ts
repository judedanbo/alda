/**
 * Pub/sub broker for real-time in-app notifications.
 *
 * Publishers (notification.service) call `publishToUser(userId, event)`
 * after creating an in-app notification. Subscribers (the SSE endpoint)
 * call `subscribeUser(userId, listener)` and forward events to the
 * browser.
 *
 * Implementation:
 *  - When REDIS_URL is configured: events go through a Redis pub/sub
 *    channel `notif:user:<userId>`, so subscribers on any instance
 *    receive them. A dedicated subscriber connection is created on
 *    first subscribe and reused.
 *  - Otherwise: events are dispatched to in-process listeners only
 *    (single-instance / dev / tests).
 *
 * Listener lifecycle: the unsubscribe callback returned by
 * subscribeUser must be invoked when the SSE client disconnects so we
 * don't leak listeners.
 */
import IORedis from "ioredis";

export interface StreamEvent {
  type: "notification.created";
  notificationId: string;
  title: string;
  message: string;
  notificationType: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

type Listener = (event: StreamEvent) => void;

const localListeners = new Map<string, Set<Listener>>();

/** Redis publisher (writes) and subscriber (reads pattern messages). */
let publisher: IORedis | null = null;
let subscriber: IORedis | null = null;
let subscriberStarted = false;

const CHANNEL_PREFIX = "notif:user:";

function redisUrl(): string | null {
  // We only use Redis when the operator opted in via the notifications
  // queue (same env). Avoids a half-on / half-off configuration.
  if (!process.env.REDIS_URL) return null;
  const cfg = useRuntimeConfig() as unknown as { notifications?: { queueEnabled?: boolean } };
  if (cfg.notifications?.queueEnabled === false) return null;
  return process.env.REDIS_URL;
}

function ensurePublisher(): IORedis | null {
  const url = redisUrl();
  if (!url) return null;
  if (!publisher) {
    publisher = new IORedis(url, { lazyConnect: true });
  }
  return publisher;
}

function ensureSubscriber(): IORedis | null {
  const url = redisUrl();
  if (!url) return null;
  if (subscriber) return subscriber;

  subscriber = new IORedis(url);
  subscriber.psubscribe(`${CHANNEL_PREFIX}*`).catch((err) => {
    console.error("[notification-stream] psubscribe failed", err);
  });
  subscriber.on("pmessage", (_pattern, channel, message) => {
    const userId = channel.slice(CHANNEL_PREFIX.length);
    const listeners = localListeners.get(userId);
    if (!listeners || listeners.size === 0) return;
    try {
      const event = JSON.parse(message) as StreamEvent;
      for (const listener of listeners) listener(event);
    } catch (err) {
      console.error("[notification-stream] failed to parse message", err);
    }
  });
  subscriberStarted = true;
  return subscriber;
}

export function subscribeUser(userId: string, listener: Listener): () => void {
  let listeners = localListeners.get(userId);
  if (!listeners) {
    listeners = new Set();
    localListeners.set(userId, listeners);
  }
  listeners.add(listener);

  // Ensure the Redis subscriber is running (no-op when REDIS_URL is unset
  // or the subscriber is already up).
  ensureSubscriber();

  return () => {
    const set = localListeners.get(userId);
    if (!set) return;
    set.delete(listener);
    if (set.size === 0) localListeners.delete(userId);
  };
}

export async function publishToUser(userId: string, event: StreamEvent): Promise<void> {
  // Always dispatch locally first — covers single-instance and tests.
  const listeners = localListeners.get(userId);
  if (listeners) {
    for (const listener of listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error("[notification-stream] local listener threw", err);
      }
    }
  }

  // Fan out across instances via Redis when configured.
  const pub = ensurePublisher();
  if (!pub) return;
  try {
    await pub.publish(`${CHANNEL_PREFIX}${userId}`, JSON.stringify(event));
  } catch (err) {
    console.error("[notification-stream] redis publish failed", err);
  }
}

/** For tests and shutdown. */
export async function closeStream(): Promise<void> {
  localListeners.clear();
  if (publisher) {
    await publisher.quit().catch(() => publisher?.disconnect());
    publisher = null;
  }
  if (subscriber) {
    await subscriber.quit().catch(() => subscriber?.disconnect());
    subscriber = null;
    subscriberStarted = false;
  }
}

// Exported for test inspection.
export const __internals = { localListeners, subscriberStarted: () => subscriberStarted };
