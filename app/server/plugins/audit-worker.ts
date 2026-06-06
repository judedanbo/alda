/**
 * Starts the BullMQ worker that drains the audit-log queue (M-10).
 *
 * - Only runs when `runtimeConfig.audit.queueEnabled` AND
 *   `runtimeConfig.audit.workerEnabled` are both true (so a deployment
 *   can run web-only pods without the worker, and a worker-only pod
 *   without the web surface).
 * - Hooks Nitro's `close` event for clean shutdown during restarts and
 *   HMR — close the worker first, then the queue + redis connection.
 */
import type { Worker } from "bullmq";
import {
  isAuditQueueEnabled,
  startAuditWorker,
  closeAuditQueue,
  type AuditJobData,
} from "~/server/utils/audit-queue";

export default defineNitroPlugin((nitroApp) => {
  const cfg = useRuntimeConfig() as unknown as { audit?: { workerEnabled?: boolean } };

  if (!isAuditQueueEnabled()) {
    console.info("[audit-worker] queue disabled — skipping worker startup");
    return;
  }
  if (cfg.audit?.workerEnabled === false) {
    console.info("[audit-worker] worker disabled on this instance");
    return;
  }

  let worker: Worker<AuditJobData> | null = null;
  try {
    worker = startAuditWorker();
    console.info("[audit-worker] worker started");
  } catch (err) {
    console.error("[audit-worker] failed to start worker", err);
    return;
  }

  nitroApp.hooks.hook("close", async () => {
    if (!worker) return;
    await worker.close().catch(() => {});
    await closeAuditQueue();
  });
});
