/**
 * Starts the BullMQ workers that drain the notification queues.
 *
 * - Only runs when `runtimeConfig.notifications.queueEnabled` AND
 *   `workerEnabled` are true (so a deployment can run web pods without
 *   the worker, and vice versa).
 * - Hooks Nitro's `close` event to shut workers down cleanly during
 *   restarts and HMR.
 */
import { startNotificationWorkers, closeQueues, isQueueEnabled } from "~/server/utils/notification-queue";

export default defineNitroPlugin((nitroApp) => {
  const cfg = useRuntimeConfig() as unknown as { notifications?: { workerEnabled?: boolean } };

  if (!isQueueEnabled()) {
    console.info("[notification-worker] queue disabled — skipping worker startup");
    return;
  }
  if (cfg.notifications?.workerEnabled === false) {
    console.info("[notification-worker] worker disabled on this instance");
    return;
  }

  let workers: ReturnType<typeof startNotificationWorkers> | null = null;
  try {
    workers = startNotificationWorkers();
    console.info("[notification-worker] workers started");
  } catch (err) {
    console.error("[notification-worker] failed to start workers", err);
    return;
  }

  nitroApp.hooks.hook("close", async () => {
    if (!workers) return;
    await Promise.allSettled([workers.email.close(), workers.sms.close()]);
    await closeQueues();
  });
});
