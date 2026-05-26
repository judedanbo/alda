import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { checkRateLimit, _resetFallbackBucketsForTests, _peekFallbackBucketForTests } from "../server/utils/rate-limit";
import type { KvStorage } from "../server/utils/analytics-storage";

/**
 * The fail-open behaviour was replaced with a per-process token-bucket
 * fallback (H-1). When the shared KV throws, `checkRateLimit` must apply
 * a conservative cap instead of returning `allowed: true`.
 */

function throwingStorage(): KvStorage {
  return {
    async getItem() {
      throw new Error("redis is down");
    },
    async setItem() {
      throw new Error("redis is down");
    },
    async removeItem() {
      throw new Error("redis is down");
    },
  };
}

describe("checkRateLimit — local fallback when storage throws", () => {
  beforeEach(() => {
    _resetFallbackBucketsForTests();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(600_000));
  });
  afterEach(() => {
    vi.useRealTimers();
    _resetFallbackBucketsForTests();
  });

  it("does NOT silently allow when storage fails", async () => {
    const storage = throwingStorage();
    const opts = { key: "ip:1.2.3.4:auth", limit: 15, windowMs: 60_000 };
    // The fallback "ip:auth" cap is 5. After 5 successful checks, the 6th
    // must be blocked even though the storage is throwing.
    for (let i = 0; i < 5; i++) {
      const r = await checkRateLimit(storage, opts);
      expect(r.allowed).toBe(true);
      expect(r.limit).toBeLessThanOrEqual(15);
    }
    const blocked = await checkRateLimit(storage, opts);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("returns the fallback limit (which is <= the configured limit)", async () => {
    const storage = throwingStorage();
    const r = await checkRateLimit(storage, {
      key: "ip:1.2.3.4:auth",
      limit: 999,
      windowMs: 60_000,
    });
    // The fallback for `ip:auth` is 5 — never weaker than the explicit limit.
    expect(r.limit).toBe(5);
  });

  it("per-key isolation: different keys do not share the fallback bucket", async () => {
    const storage = throwingStorage();
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(storage, { key: "ip:1.1.1.1:auth", limit: 15, windowMs: 60_000 });
    }
    // Same key would be blocked now.
    const sameKey = await checkRateLimit(storage, { key: "ip:1.1.1.1:auth", limit: 15, windowMs: 60_000 });
    expect(sameKey.allowed).toBe(false);
    // Different IP still has its own fresh bucket.
    const otherKey = await checkRateLimit(storage, { key: "ip:2.2.2.2:auth", limit: 15, windowMs: 60_000 });
    expect(otherKey.allowed).toBe(true);
  });

  it("classifies keys by prefix — `user:` gets the per-user cap, not the auth cap", async () => {
    const storage = throwingStorage();
    // The fallback for `user:default` is 60. After 60 succeed, the 61st blocks.
    for (let i = 0; i < 60; i++) {
      const r = await checkRateLimit(storage, { key: `user:abc`, limit: 600, windowMs: 60_000 });
      expect(r.allowed).toBe(true);
    }
    const blocked = await checkRateLimit(storage, { key: `user:abc`, limit: 600, windowMs: 60_000 });
    expect(blocked.allowed).toBe(false);
  });

  it("rolls over to a fresh window after the fallback window elapses", async () => {
    const storage = throwingStorage();
    for (let i = 0; i < 5; i++) {
      await checkRateLimit(storage, { key: "ip:roll:auth", limit: 15, windowMs: 60_000 });
    }
    expect((await checkRateLimit(storage, { key: "ip:roll:auth", limit: 15, windowMs: 60_000 })).allowed).toBe(false);

    // Advance into the next 60-second window.
    vi.setSystemTime(new Date(600_000 + 60_001));
    const r = await checkRateLimit(storage, { key: "ip:roll:auth", limit: 15, windowMs: 60_000 });
    expect(r.allowed).toBe(true);
  });

  it("does not touch the fallback bucket when shared storage is healthy", async () => {
    // Plain in-memory KV — no throws.
    const map = new Map<string, unknown>();
    const storage: KvStorage = {
      async getItem<T>(key: string) {
        return (map.get(key) as T) ?? null;
      },
      async setItem(key: string, value: unknown) {
        map.set(key, value);
      },
      async removeItem(key: string) {
        map.delete(key);
      },
    };
    for (let i = 0; i < 3; i++) {
      await checkRateLimit(storage, { key: "ip:healthy:auth", limit: 15, windowMs: 60_000 });
    }
    expect(_peekFallbackBucketForTests("ip:healthy:auth")).toBeUndefined();
  });
});
