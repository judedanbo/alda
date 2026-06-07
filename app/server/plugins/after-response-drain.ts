/**
 * Drains best-effort background work registered via `runAfterResponse` when
 * Nitro shuts down (k8s SIGTERM, restart, HMR).
 *
 * Without this, notification bookkeeping detached from the response could be
 * cut off mid-flight on shutdown. Nitro runs `close` hooks in plugin-filename
 * order; this file sorts before `notification-worker.ts`, so the drain
 * completes (including any email/sms job enqueues) before that plugin closes
 * the BullMQ queues.
 */
import { drainAfterResponse } from "~/server/utils/after-response";

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("close", async () => {
    await drainAfterResponse();
  });
});
