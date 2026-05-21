import { describe, it, expect } from "vitest";
import { checkRateLimit, throwRateLimited } from "../server/utils/rate-limit";
import { makeFakeStorage, makeFakeEvent } from "./helpers";

/**
 * Integration check across the rate-limit units: driving a limiter to
 * exhaustion and then raising the response must yield an HTTP 429 carrying
 * `Retry-After` data — the contract the security middleware relies on.
 */
describe("rate limiting — exceeding a limit yields HTTP 429", () => {
  it("blocks past the limit and throwRateLimited raises a 429", async () => {
    const storage = makeFakeStorage();
    const opts = { key: "ip:flood-test", limit: 10, windowMs: 60_000 };

    let lastResult = await checkRateLimit(storage, opts);
    let allowedCount = lastResult.allowed ? 1 : 0;
    for (let i = 0; i < 20; i++) {
      lastResult = await checkRateLimit(storage, opts);
      if (lastResult.allowed) allowedCount++;
    }

    // Exactly `limit` requests should have been allowed.
    expect(allowedCount).toBe(10);
    expect(lastResult.allowed).toBe(false);

    // Raising the limit response produces a well-formed 429.
    let thrown: unknown;
    try {
      throwRateLimited(makeFakeEvent() as never, lastResult, "client IP");
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeDefined();
    const err = thrown as { statusCode?: number; data?: { retryAfterSeconds?: number; scope?: string } };
    expect(err.statusCode).toBe(429);
    expect(err.data?.scope).toBe("client IP");
    expect(err.data?.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("normal traffic well under the limit is never blocked", async () => {
    const storage = makeFakeStorage();
    const opts = { key: "ip:normal", limit: 300, windowMs: 60_000 };
    for (let i = 0; i < 50; i++) {
      expect((await checkRateLimit(storage, opts)).allowed).toBe(true);
    }
  });
});
