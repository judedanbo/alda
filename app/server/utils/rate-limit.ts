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
 * In-process fallback counters used when shared storage (Redis or the
 * in-memory driver) throws. Per-pod / per-process state; the caps are
 * deliberately tight because the only reason to enter this branch is "we
 * lost shared state" — better to over-throttle than to open the door.
 * `min(normalLimit, FALLBACK_LIMITS[group])` guarantees the fallback can
 * never be weaker than the configured limit.
 */
const FALLBACK_LIMITS: Record<string, number> = {
  "ip:auth": 5,
  "ip:upload": 6,
  "ip:write": 20,
  "ip:verify": 10,
  "ip:default": 60,
  "user:default": 60,
};
const FALLBACK_WINDOW_MS = 60_000;
const fallbackBuckets = new Map<string, { winStart: number; count: number }>();

function fallbackLimitFor(key: string, normalLimit: number): number {
  // Pick a fallback class from the key's prefix; otherwise fall back to "default".
  let cls = "ip:default";
  if (key.startsWith("ip:") && key.includes(":auth")) cls = "ip:auth";
  else if (key.startsWith("ip:") && key.includes(":upload")) cls = "ip:upload";
  else if (key.startsWith("ip:") && key.includes(":write")) cls = "ip:write";
  else if (key.startsWith("ip:") && key.includes(":verify")) cls = "ip:verify";
  else if (key.startsWith("ip:")) cls = "ip:default";
  else if (key.startsWith("user:")) cls = "user:default";
  return Math.min(normalLimit, FALLBACK_LIMITS[cls] ?? FALLBACK_LIMITS["ip:default"]!);
}

function localFallbackCheck(key: string, normalLimit: number): RateLimitResult {
  const limit = fallbackLimitFor(key, normalLimit);
  const now = Date.now();
  const winStart = now - (now % FALLBACK_WINDOW_MS);
  const bucket = fallbackBuckets.get(key);
  let count = bucket && bucket.winStart === winStart ? bucket.count : 0;
  const allowed = count + 1 <= limit;
  if (allowed) {
    count += 1;
    fallbackBuckets.set(key, { winStart, count });
  }
  const resetMs = FALLBACK_WINDOW_MS - (now - winStart);
  return {
    allowed,
    limit,
    remaining: Math.max(0, limit - count),
    resetMs,
    retryAfterMs: allowed ? 0 : Math.max(1000, resetMs),
  };
}

/** Test-only: drop the per-process fallback buckets. */
export function _resetFallbackBucketsForTests(): void {
  fallbackBuckets.clear();
}

/** Test-only: snapshot the per-process fallback bucket count for a key. */
export function _peekFallbackBucketForTests(key: string): { winStart: number; count: number } | undefined {
  return fallbackBuckets.get(key);
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
    // Shared storage failed. Fall *closed* via a tiny per-process bucket
    // with a conservative cap — preserves the basic rate-limit guarantee
    // during a Redis outage instead of opening the floodgates.
    console.error(`[rate-limit] storage failed for ${key} — applying local fallback:`, error);
    return localFallbackCheck(key, limit);
  }
}

export type RouteGroupName = "auth" | "upload" | "write" | "verify" | "default";

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
  if (path.startsWith("/api/verify/")) {
    // M-9: code-verification lookups by Legal Unit / Schedule Officer /
    // admin. Even with the per-IP limit, a compromised account could
    // iterate codes via the lax per-user budget. Group cap at 90/min/IP;
    // the rate-limit-user middleware (M-7) divides by 3 → 30/min/user.
    return { name: "verify", limit: 90, windowMs: 60_000 };
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
    setResponseHeader(event, "Retry-After", Math.ceil(result.retryAfterMs / 1000));
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
