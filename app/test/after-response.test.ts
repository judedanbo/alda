/**
 * Unit tests for the runAfterResponse / drainAfterResponse helper that moves
 * best-effort work (notifications) off the HTTP response path.
 *
 * Regression intent: this helper is what makes notification dispatch
 * non-blocking. These tests lock its contract — detach, swallow+log errors,
 * and drain in-flight work on shutdown (with a timeout escape hatch).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { runAfterResponse, drainAfterResponse } from "~/server/utils/after-response";

function deferred<T = void>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runAfterResponse", () => {
  it("swallows a rejecting promise and logs it with the label", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Must not throw synchronously even though the work rejects.
    expect(() =>
      runAfterResponse(Promise.reject(new Error("boom")), "notify:TEST_LABEL"),
    ).not.toThrow();

    await flush();

    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(String(errSpy.mock.calls[0]![0])).toContain("notify:TEST_LABEL");
  });

  it("does not log when the work resolves", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    runAfterResponse(Promise.resolve("ok"), "notify:OK");
    await flush();

    expect(errSpy).not.toHaveBeenCalled();
  });
});

describe("drainAfterResponse", () => {
  it("waits for outstanding work before resolving", async () => {
    const d = deferred();
    let workDone = false;
    runAfterResponse(
      d.promise.then(() => {
        workDone = true;
      }),
      "pending-work",
    );

    let drained = false;
    const drainP = drainAfterResponse(1000).then(() => {
      drained = true;
    });

    // While the work is still pending, drain must not have resolved.
    await flush();
    expect(drained).toBe(false);

    d.resolve();
    await drainP;
    expect(drained).toBe(true);
    expect(workDone).toBe(true);
  });

  it("resolves via its timeout even if work never settles", async () => {
    // Use a deferred we clean up afterwards so the stuck promise does not
    // linger in the module-level in-flight set across tests.
    const stuck = deferred();
    runAfterResponse(stuck.promise, "stuck-forever");

    // If the timeout did not fire, this await would hang and the test times out.
    await drainAfterResponse(50);

    stuck.resolve();
    await flush();
  });

  it("resolves immediately when nothing is in flight", async () => {
    await expect(drainAfterResponse()).resolves.toBeUndefined();
  });
});
