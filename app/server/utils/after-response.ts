/**
 * Run best-effort background work WITHOUT blocking the HTTP response.
 *
 * Several state-changing endpoints trigger notifications whose *result is
 * never used by the response* — the applicant doesn't need to wait for the
 * in-app row, delivery-log writes, and SSE publish before getting their 200.
 * Today those handlers `await sendNotification(...)`, adding ~5-15 DB
 * round-trips to the critical path. Wrapping the call in `runAfterResponse`
 * lets the handler return immediately while the bookkeeping continues.
 *
 * This app runs as a persistent Node server (Nitro `node-server` preset), so a
 * detached promise keeps running after the response is flushed — there is no
 * serverless teardown to cut it off. h3 1.15 has no `event.waitUntil`, so we
 * manage the lifetime ourselves.
 *
 * IMPORTANT: `work` must be a promise that does not reject in normal operation
 * (e.g. `sendNotification` is swallow-all). This helper still attaches a
 * `.catch` so a stray rejection is logged rather than crashing the process as
 * an unhandledRejection — but it is a safety net, not the primary error path.
 */

// Tracks in-flight background work so a graceful shutdown can optionally drain
// it. Exported for `drainAfterResponse()` (called from a shutdown hook).
const inFlight = new Set<Promise<unknown>>();

/**
 * Fire `work` in the background and return immediately.
 *
 * @param work  the background promise (e.g. `sendNotification(payload)`)
 * @param label short description used in error logs, e.g. "notify:RECEIPT_READY"
 *
 * TODO(human): implement the body.
 *
 * The meaningful decision: this is a compliance app, but the work here is
 * already best-effort and durably queued downstream (BullMQ). Do we:
 *   (a) keep it simple — detach, attach a `.catch` that logs `label` + error,
 *       and accept that work in-flight during an ungraceful crash is lost; or
 *   (b) also register the promise in `inFlight` (and remove it on settle) so a
 *       shutdown hook can await outstanding work before exiting?
 *
 * Tracking costs a Set add/delete per call and only pays off if you wire
 * `drainAfterResponse()` into graceful shutdown. Pick the trade-off that fits
 * how much you trust the process to stay up, then implement ~6-8 lines here.
 * Must NOT return the promise (callers should not be able to await it).
 */
export function runAfterResponse(work: Promise<unknown>, label: string): void {
  // Track the original promise so `drainAfterResponse` can await it on
  // shutdown. The logging/cleanup chain is separate so it doesn't replace the
  // tracked reference, and so a rejection is logged rather than surfacing as an
  // unhandledRejection.
  inFlight.add(work);
  work
    .catch((error) => {
      console.error(`[after-response] ${label} failed`, {
        error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
      });
    })
    .finally(() => {
      inFlight.delete(work);
    });
}

/**
 * Await all outstanding background work, up to `timeoutMs`. Intended for a
 * graceful-shutdown hook. No-op (resolves immediately) if option (a) was
 * chosen above and `inFlight` is never populated.
 */
export async function drainAfterResponse(timeoutMs = 5_000): Promise<void> {
  if (inFlight.size === 0) return;
  await Promise.race([
    Promise.allSettled([...inFlight]),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}
