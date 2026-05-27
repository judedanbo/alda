import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * The lockout helpers read from the live `getAnalyticsStorage()` global.
 * The test setup stubs `useStorage` with a Map-backed shim (see
 * test/setup.ts), so we redirect `getAnalyticsStorage` to that same
 * shim for these cases.
 */
const memoryStore = new Map<string, unknown>();

vi.mock("~/server/utils/analytics-storage", async () => {
  return {
    getAnalyticsStorage: () => ({
      async getItem<T>(key: string): Promise<T | null> {
        return (memoryStore.get(key) as T) ?? null;
      },
      async setItem(key: string, value: unknown): Promise<void> {
        memoryStore.set(key, value);
      },
      async removeItem(key: string): Promise<void> {
        memoryStore.delete(key);
      },
    }),
    safeGet: async (storage: { getItem<T>(k: string): Promise<T | null> }, key: string) => {
      try {
        return await storage.getItem(key);
      } catch {
        return null;
      }
    },
    StorageKeys: {},
  };
});

const { isAccountLocked, recordLoginFailure, clearLoginFailures, _LOCKOUT_CONSTANTS_FOR_TESTS } = await import(
  "~/server/utils/auth-lockout"
);

const { FAIL_THRESHOLD } = _LOCKOUT_CONSTANTS_FOR_TESTS;

beforeEach(() => {
  memoryStore.clear();
});

describe("auth-lockout", () => {
  it("starts unlocked", async () => {
    expect(await isAccountLocked("u1")).toEqual({ locked: false });
  });

  it("increments the counter without locking before the threshold", async () => {
    for (let i = 0; i < FAIL_THRESHOLD - 1; i++) {
      const state = await recordLoginFailure("u1");
      expect(state.locked).toBe(false);
    }
    expect(await isAccountLocked("u1")).toEqual({ locked: false });
  });

  it("locks the account when the threshold is reached", async () => {
    let last: Awaited<ReturnType<typeof recordLoginFailure>> = { locked: false };
    for (let i = 0; i < FAIL_THRESHOLD; i++) {
      last = await recordLoginFailure("u1");
    }
    expect(last.locked).toBe(true);
    expect(last.unlockAt).toMatch(/T/);

    const state = await isAccountLocked("u1");
    expect(state.locked).toBe(true);
    expect(state.unlockAt).toBe(last.unlockAt);
  });

  it("clearLoginFailures removes both the counter and the lock", async () => {
    for (let i = 0; i < FAIL_THRESHOLD; i++) {
      await recordLoginFailure("u1");
    }
    expect((await isAccountLocked("u1")).locked).toBe(true);

    await clearLoginFailures("u1");
    expect(await isAccountLocked("u1")).toEqual({ locked: false });

    // Counter is also cleared — the next FAIL_THRESHOLD-1 failures
    // shouldn't lock.
    for (let i = 0; i < FAIL_THRESHOLD - 1; i++) {
      const state = await recordLoginFailure("u1");
      expect(state.locked).toBe(false);
    }
  });

  it("treats a lock with a past `until` as cleared", async () => {
    // Plant a stale lock manually.
    memoryStore.set("account-lock:u1", { until: new Date(Date.now() - 60_000).toISOString() });
    expect(await isAccountLocked("u1")).toEqual({ locked: false });
  });

  it("isolates per-user state", async () => {
    for (let i = 0; i < FAIL_THRESHOLD; i++) {
      await recordLoginFailure("u1");
    }
    expect((await isAccountLocked("u1")).locked).toBe(true);
    expect((await isAccountLocked("u2")).locked).toBe(false);
  });
});
