import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { checkRateLimit, classifyRouteGroup } from "../server/utils/rate-limit";
import type { KvStorage } from "../server/utils/analytics-storage";
import { makeFakeStorage } from "./helpers";

describe("checkRateLimit — sliding window counter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(600_000)); // aligned to a 60s window boundary
  });
  afterEach(() => vi.useRealTimers());

  it("allows requests up to the limit, then blocks", async () => {
    const storage = makeFakeStorage();
    const opts = { key: "ip:1.2.3.4", limit: 5, windowMs: 60_000 };

    for (let i = 0; i < 5; i++) {
      expect((await checkRateLimit(storage, opts)).allowed).toBe(true);
    }
    const blocked = await checkRateLimit(storage, opts);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("does not consume quota when peeking", async () => {
    const storage = makeFakeStorage();
    const opts = { key: "ip:peek", limit: 3, windowMs: 60_000, peek: true };
    for (let i = 0; i < 10; i++) {
      expect((await checkRateLimit(storage, opts)).allowed).toBe(true);
    }
  });

  it("slides: the previous window decays as time passes", async () => {
    const storage = makeFakeStorage();
    const opts = { key: "ip:slide", limit: 5, windowMs: 60_000 };
    for (let i = 0; i < 5; i++) await checkRateLimit(storage, opts);

    // Early in the next window the previous count is fully weighted → blocked.
    vi.setSystemTime(new Date(600_000 + 60_000 + 1_000));
    expect((await checkRateLimit(storage, opts)).allowed).toBe(false);

    // Late in the next window the previous count has mostly decayed → allowed.
    vi.setSystemTime(new Date(600_000 + 60_000 + 50_000));
    expect((await checkRateLimit(storage, opts)).allowed).toBe(true);
  });

  it("fully resets after two idle windows", async () => {
    const storage = makeFakeStorage();
    const opts = { key: "ip:reset", limit: 2, windowMs: 60_000 };
    await checkRateLimit(storage, opts);
    await checkRateLimit(storage, opts);
    expect((await checkRateLimit(storage, opts)).allowed).toBe(false);

    vi.setSystemTime(new Date(600_000 + 2 * 60_000));
    const fresh = await checkRateLimit(storage, opts);
    expect(fresh.allowed).toBe(true);
    expect(fresh.remaining).toBe(1);
  });

  it("fails open when storage throws", async () => {
    const broken: KvStorage = {
      getItem: async () => { throw new Error("storage down"); },
      setItem: async () => { throw new Error("storage down"); },
      removeItem: async () => {},
    };
    const result = await checkRateLimit(broken, { key: "x", limit: 1, windowMs: 60_000 });
    expect(result.allowed).toBe(true);
  });
});

describe("classifyRouteGroup", () => {
  it("applies the stricter limiter for auth, upload and write routes", () => {
    expect(classifyRouteGroup("POST", "/api/auth/login")?.name).toBe("auth");
    expect(classifyRouteGroup("POST", "/api/upload/ghana-card")?.name).toBe("upload");
    expect(classifyRouteGroup("POST", "/api/declarations")?.name).toBe("write");
    expect(classifyRouteGroup("DELETE", "/api/profile/offices/abc")?.name).toBe("write");
  });

  it("leaves plain reads to the global per-IP limit only", () => {
    expect(classifyRouteGroup("GET", "/api/declarations")).toBeNull();
    expect(classifyRouteGroup("GET", "/api/admin/stats")).toBeNull();
  });

  it("M-9: caps /api/verify/<code> at 90/min/IP (→ 30/min/user via M-7 divisor)", () => {
    const g = classifyRouteGroup("GET", "/api/verify/ADLA-20260601-AB123");
    expect(g?.name).toBe("verify");
    expect(g?.limit).toBe(90);
    expect(g?.windowMs).toBe(60_000);
  });
});
