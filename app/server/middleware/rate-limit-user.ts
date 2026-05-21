import { getAnalyticsConfig } from "~/server/utils/analytics-config";
import { getAnalyticsStorage } from "~/server/utils/analytics-storage";
import {
  checkRateLimit,
  applyRateLimitHeaders,
  throwRateLimited,
} from "~/server/utils/rate-limit";

/**
 * Per-authenticated-user rate limiter.
 *
 * Filename-ordered to run AFTER `auth.ts` (`rate-limit-user` > `auth`), so
 * `event.context.auth` is populated. This complements the IP-scoped limits in
 * `00.security.ts` with a per-user budget — a single account cannot exhaust
 * the service even from many IPs. Fail-open like the security middleware.
 */

function isHttpError(error: unknown): boolean {
  return !!error && typeof error === "object" && "statusCode" in error;
}

export default defineEventHandler(async (event) => {
  const config = getAnalyticsConfig();
  if (!config.enabled || !config.rateLimitEnabled) return;

  const auth = event.context.auth;
  const actx = event.context.analytics;
  if (!auth || !actx || actx.excluded) return;

  const path = getRequestURL(event).pathname;
  if (!path.startsWith("/api/")) return;

  try {
    const result = await checkRateLimit(getAnalyticsStorage(), {
      key: `user:${auth.userId}`,
      limit: config.rl.userPerMin,
      windowMs: 60_000,
    });
    applyRateLimitHeaders(event, result);
    if (!result.allowed) throwRateLimited(event, result, "authenticated user");
  } catch (error) {
    if (isHttpError(error)) throw error;
    console.error("[rate-limit-user] middleware error — failing open:", error);
  }
});
