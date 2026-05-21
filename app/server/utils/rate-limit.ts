import type { H3Event } from "h3";
import { getAnalyticsConfig } from "./analytics-config";
import { StorageKeys, type KvStorage } from "./analytics-storage";

/**
 * Layered, configurable rate limiting.
 *
 * Algorithm: **sliding-window counter**. Each limiter key stores a single
 * small object — the aligned current window start plus the current and
 * previous window counts — and the effective count is the current count plus
 * a time-weighted fraction of the previous window. This was chosen over a
 * token bucket because it needs no background refill timer and no per-request
 * timestamp arithmetic beyond one modulo, and over a sliding-window *log*
 * because it stores O(1) data per actor instead of one entry per request.
 *
 * Counters live in Nitro `analytics` storage (redis when configured — correct
 * across instances; otherwise the in-memory driver — correct per-instance
 * only). Read-modify-write is not atomic, so under extreme concurrency a
 * counter may be off by a few; that is acceptable for rate limiting and the
 * limiter always fails open on storage errors.
 */

export interface RateLimitOptions {
  /** Unique limiter identity, e.g. `ip:1.2.3.4` or `user:<uuid>:auth`. */
  key: string;
  /** Maximum weighted requests permitted per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Request weight (default 1). */
  cost?: number;
  /** When true, evaluate without consuming quota. */
  peek?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Milliseconds until the current window boundary. */
  resetMs: number;
  /** Milliseconds the caller should wait before retrying (0 when allowed). */
  retryAfterMs: number;
}

interface WindowState {
  winStart: number;
  count: number;
  prevCount: number;
}

/**
 * Evaluates (and, unless `peek`, consumes) one unit of a sliding-window
 * limiter. Fails open: any storage error yields an `allowed` result.
 */
export async function checkRateLimit(
  storage: KvStorage,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  const { key, limit, windowMs } = opts;
  const cost = opts.cost ?? 1;
  const peek = opts.peek ?? false;
  const now = Date.now();
  const winStart = now - (now % windowMs);
  const elapsed = now - winStart;
  const storageKey = StorageKeys.rateLimit(key);

  try {
    const stored = await storage.getItem<WindowState>(storageKey);

    let count = 0;
    let prevCount = 0;
    if (stored) {
      if (stored.winStart === winStart) {
        count = stored.count;
        prevCount = stored.prevCount;
      } else if (stored.winStart === winStart - windowMs) {
        prevCount = stored.count;
      }
      // Older than two windows: both counts stay 0.
    }

    const weight = (windowMs - elapsed) / windowMs;
    const estimated = prevCount * weight + count;
    const allowed = estimated + cost <= limit;

    if (allowed && !peek) {
      count += cost;
      await storage.setItem(
        storageKey,
        { winStart, count, prevCount } satisfies WindowState,
        { ttl: Math.ceil((windowMs * 2) / 1000) },
      );
    }

    const consumed = estimated + (allowed && !peek ? cost : 0);
    const remaining = Math.max(0, Math.floor(limit - consumed));
    const resetMs = windowMs - elapsed;

    return {
      allowed,
      limit,
      remaining,
      resetMs,
      retryAfterMs: allowed ? 0 : Math.max(1000, resetMs),
    };
  } catch (error) {
    console.error(`[rate-limit] check failed for ${key} — failing open:`, error);
    return { allowed: true, limit, remaining: limit, resetMs: windowMs, retryAfterMs: 0 };
  }
}

export type RouteGroupName = "auth" | "upload" | "write" | "default";

export interface RouteGroup {
  name: RouteGroupName;
  limit: number;
  windowMs: number;
}

/**
 * Classifies a request into its stricter per-route-group limiter. Returns
 * `null` for plain reads, which are covered by the global per-IP limit only.
 */
export function classifyRouteGroup(method: string, path: string): RouteGroup | null {
  const { rl } = getAnalyticsConfig();
  const m = method.toUpperCase();

  if (path.startsWith("/api/auth/")) {
    return { name: "auth", limit: rl.authPerMin, windowMs: 60_000 };
  }
  if (path.startsWith("/api/upload")) {
    return { name: "upload", limit: rl.uploadPer5Min, windowMs: 300_000 };
  }
  if (m === "POST" || m === "PUT" || m === "PATCH" || m === "DELETE") {
    return { name: "write", limit: rl.writePerMin, windowMs: 60_000 };
  }
  return null;
}

/** Sets the IETF `RateLimit-*` response headers (and `Retry-After` on block). */
export function applyRateLimitHeaders(event: H3Event, result: RateLimitResult): void {
  setResponseHeader(event, "RateLimit-Limit", String(result.limit));
  setResponseHeader(event, "RateLimit-Remaining", String(result.remaining));
  setResponseHeader(event, "RateLimit-Reset", String(Math.ceil(result.resetMs / 1000)));
  if (!result.allowed) {
    setResponseHeader(event, "Retry-After", String(Math.ceil(result.retryAfterMs / 1000)));
  }
}

/**
 * Sets the rate-limit headers and throws a well-formed HTTP 429. Callers
 * should `throw` the return value (typed `never` so control flow is clear).
 */
export function throwRateLimited(event: H3Event, result: RateLimitResult, scope: string): never {
  applyRateLimitHeaders(event, result);
  throw createError({
    statusCode: 429,
    statusMessage: "Too Many Requests",
    message: `Rate limit exceeded for ${scope}. Retry after ${Math.ceil(result.retryAfterMs / 1000)}s.`,
    data: {
      scope,
      retryAfterSeconds: Math.ceil(result.retryAfterMs / 1000),
      limit: result.limit,
    },
  });
}
