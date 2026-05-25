/**
 * Tests for the in-process notification pub/sub broker. Redis paths
 * are not exercised here (no live Redis in the test environment);
 * coverage for the Redis fan-out belongs in an integration test.
 *
 * We do verify that publishToUser is async-safe and that unsubscribe
 * actually removes the listener.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Ensure Redis is treated as unavailable so the in-process path runs.
const ORIGINAL_ENV = { ...process.env };
beforeEach(() => {
  delete process.env.REDIS_URL;
});
afterEach(() => {
  for (const k of Object.keys(process.env)) {
    if (!(k in ORIGINAL_ENV)) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete process.env[k];
    }
  }
  Object.assign(process.env, ORIGINAL_ENV);
});

const { subscribeUser, publishToUser, closeStream, __internals } = await import(
  "~/server/utils/notification-stream"
);

afterEach(async () => {
  await closeStream();
});

function makeEvent(notificationId: string) {
  return {
    type: "notification.created" as const,
    notificationId,
    title: "t",
    message: "m",
    notificationType: "REVIEW_APPROVED",
    createdAt: new Date().toISOString(),
  };
}

describe("notification-stream — local pub/sub", () => {
  it("delivers a published event to a subscribed listener", async () => {
    const received: string[] = [];
    const unsub = subscribeUser("user-1", (e) => received.push(e.notificationId));

    await publishToUser("user-1", makeEvent("n-1"));

    expect(received).toEqual(["n-1"]);
    unsub();
  });

  it("delivers an event to every subscribed listener for the same user", async () => {
    const a: string[] = [];
    const b: string[] = [];
    const unsubA = subscribeUser("user-2", (e) => a.push(e.notificationId));
    const unsubB = subscribeUser("user-2", (e) => b.push(e.notificationId));

    await publishToUser("user-2", makeEvent("n-2"));

    expect(a).toEqual(["n-2"]);
    expect(b).toEqual(["n-2"]);
    unsubA();
    unsubB();
  });

  it("does not deliver across users", async () => {
    const received: string[] = [];
    const unsub = subscribeUser("user-3", (e) => received.push(e.notificationId));

    await publishToUser("user-4", makeEvent("n-3"));

    expect(received).toEqual([]);
    unsub();
  });

  it("unsubscribe stops further delivery and cleans the map", async () => {
    const received: string[] = [];
    const unsub = subscribeUser("user-5", (e) => received.push(e.notificationId));
    await publishToUser("user-5", makeEvent("a"));
    unsub();
    await publishToUser("user-5", makeEvent("b"));

    expect(received).toEqual(["a"]);
    // Last subscriber left → key removed.
    expect(__internals.localListeners.has("user-5")).toBe(false);
  });

  it("isolates exceptions in a listener from other listeners", async () => {
    const received: string[] = [];
    const unsubA = subscribeUser("user-6", () => {
      throw new Error("boom");
    });
    const unsubB = subscribeUser("user-6", (e) => received.push(e.notificationId));

    await expect(publishToUser("user-6", makeEvent("z"))).resolves.toBeUndefined();
    expect(received).toEqual(["z"]);
    unsubA();
    unsubB();
  });

  it("does not start a Redis subscriber when REDIS_URL is unset", async () => {
    const unsub = subscribeUser("user-7", () => {});
    expect(__internals.subscriberStarted()).toBe(false);
    unsub();
  });
});
