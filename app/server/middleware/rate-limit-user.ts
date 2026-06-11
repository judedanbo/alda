import { getAnalyticsConfig } from "~/server/utils/analytics-config";
import { getAnalyticsStorage } from "~/server/utils/analytics-storage";
import {
  checkRateLimit,
  classifyRouteGroup,
  applyRateLimitHeaders,
  throwRateLimited,
} from "~/server/utils/rate-limit";
import { logAuditOnce, AuditActions } from "~/server/utils/audit";

/**
 * Per-authenticated-user rate limiter.
 *
 * Filename-ordered to run AFTER `auth.ts` (`rate-limit-user` > `auth`), so
 * `event.context.auth` is populated. Two layered checks:
 *
 * 1. Overall per-user budget (`config.rl.userPerMin`) — caps total request
 *    rate per authenticated user regardless of route.
 * 2. Per-route-group sub-budget (M-7) — write / upload endpoints get a
 *    much tighter user-scoped cap so a single account can't push 600
 *    receipt-PDF generations per minute. The group classifier is shared
 *    with the IP limiter (`classifyRouteGroup`).
 *
 * Fail-open is now `fail-closed-local` thanks to H-1: `checkRateLimit`
 * applies a per-process Map fallback when shared storage throws.
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

  const method = (event.method || "GET").toUpperCase();
  const storage = getAnalyticsStorage();

  try {
    const result = await checkRateLimit(storage, {
      key: `user:${auth.userId}`,
      limit: config.rl.userPerMin,
      windowMs: 60_000,
    });
    applyRateLimitHeaders(event, result);
    if (!result.allowed) {
      // Deduped per user so a single account hammering the API yields ~one
      // row per minute. Unlike the IP limiter, here we know who it is.
      logAuditOnce(
        event,
        {
          userId: auth.userId,
          action: AuditActions.RATE_LIMIT_EXCEEDED,
          entityType: "user",
          entityId: auth.userId,
          newValues: { scope: "authenticated_user", path, method },
        },
        { key: `user:${auth.userId}` },
      );
      throwRateLimited(event, result, "authenticated user");
    }

    // M-7: layer a per-user-per-route-group cap on top of the overall
    // budget. `userWritePerMin` and `userUploadPer5Min` derive from the
    // IP-scoped limits scaled down by a factor — they're tighter than
    // the overall user budget but laxer than the per-IP limits.
    const group = classifyRouteGroup(method, path);
    if (group) {
      // Reuse the IP-group limit divided by 3 as a sensible per-user cap;
      // covers writes and uploads automatically as the IP limits change.
      const userGroupLimit = Math.max(1, Math.floor(group.limit / 3));
      const groupResult = await checkRateLimit(storage, {
        key: `user:${auth.userId}:${group.name}`,
        limit: userGroupLimit,
        windowMs: group.windowMs,
      });
      if (!groupResult.allowed) {
        await createAuditLogOnce(
          event,
          {
            userId: auth.userId,
            action: AuditActions.RATE_LIMIT_EXCEEDED,
            entityType: "user",
            entityId: auth.userId,
            newValues: { scope: `authenticated_user_${group.name}`, path, method },
          },
          { key: `user:${auth.userId}` },
        );
        throwRateLimited(event, groupResult, `authenticated user ${group.name}`);
      }
    }
  } catch (error) {
    if (isHttpError(error)) throw error;
    console.error("[rate-limit-user] middleware error — failing open:", error);
  }
});
