import { getAnalyticsConfig } from "~/server/utils/analytics-config";
import {
  getAnalyticsStorage,
  StorageKeys,
  safeGet,
} from "~/server/utils/analytics-storage";
import {
  checkRateLimit,
  classifyRouteGroup,
  applyRateLimitHeaders,
  throwRateLimited,
} from "~/server/utils/rate-limit";
import { getEnforcement } from "~/server/utils/abuse";
import {
  verifyAiIdentity,
  policyForAiCategory,
  isAiRobotsViolation,
  type AiVerificationVerdict,
} from "~/server/utils/ai-agents";
import { logAuditOnce, AuditActions } from "~/server/utils/audit";

/**
 * IP-scoped security middleware.
 *
 * Filename-ordered to run FIRST — before `auth.ts` — so floods and blocked
 * actors are rejected before any JWT work. It enforces operator/automatic
 * blocks, the per-category AI policy, and the global per-IP + per-route-group
 * rate limits. Per-user limits (which need `event.context.auth`) live in the
 * post-auth `rate-limit-user.ts` middleware instead.
 *
 * Fail-open: intentional 403/429 responses propagate, but any unexpected
 * internal error is swallowed so the request proceeds normally.
 */

function isHttpError(error: unknown): boolean {
  return !!error && typeof error === "object" && "statusCode" in error;
}

export default defineEventHandler(async (event) => {
  const config = getAnalyticsConfig();
  if (!config.enabled) return;

  const actx = event.context.analytics;
  if (!actx || actx.excluded) return;

  try {
    const path = getRequestURL(event).pathname;
    const method = (event.method || "GET").toUpperCase();
    const storage = getAnalyticsStorage();
    const ip = actx.ip;

    // 1. Operator allow list — bypass all enforcement.
    const onAllowList = !!(await safeGet(storage, StorageKeys.allow("ip", ip)));

    // 2. Operator/automatic blocks.
    if (!onAllowList) {
      const manualBlock = await safeGet<{ reason?: string }>(storage, StorageKeys.block("ip", ip));
      if (manualBlock) {
        throw createError({
          statusCode: 403,
          statusMessage: "Forbidden",
          message: "Your access has been blocked by an administrator.",
        });
      }
    }

    const enforcement = onAllowList ? null : await getEnforcement(storage, ip);
    if (enforcement?.type === "BLOCK") {
      throw createError({
        statusCode: 403,
        statusMessage: "Forbidden",
        message: "Access temporarily blocked due to abusive activity.",
      });
    }

    // 3. AI crawler policy.
    let aiThrottle = false;
    const cls = actx.classification;
    if (config.aiDetectionEnabled && cls.visitorClass === "AI_AGENT" && cls.agentDef) {
      const category = cls.aiCategory ?? "UNKNOWN_SCRAPER";
      const policy = policyForAiCategory(category);

      // Verification verdict comes from cache; on a miss, verify in the
      // background so the NEXT request from this IP has a verdict — keeps
      // this request free of a DNS round-trip.
      let verdict = await safeGet<AiVerificationVerdict>(storage, StorageKeys.aiVerify(ip));
      if (!verdict) {
        void verifyAiIdentity(cls.agentDef, ip, storage);
        verdict = "unverified";
      }
      event.context.analytics!.aiVerified = verdict;

      if (verdict === "spoofed") {
        // Deduped per IP so a persistent spoofer yields one row per window,
        // not one per request.
        logAuditOnce(
          event,
          {
            action: AuditActions.AI_AGENT_SPOOFED,
            entityType: "ip",
            entityId: ip,
            newValues: { path, category, agent: cls.agentDef.name },
          },
          { key: ip },
        );
        throw createError({
          statusCode: 403,
          statusMessage: "Forbidden",
          message: "Request rejected: AI-agent identity could not be verified.",
        });
      }

      if (policy === "block") {
        logAuditOnce(
          event,
          {
            action: AuditActions.AI_AGENT_BLOCKED,
            entityType: "ip",
            entityId: ip,
            newValues: { path, category, agent: cls.agentDef.name },
          },
          { key: ip },
        );
        throw createError({
          statusCode: 403,
          statusMessage: "Forbidden",
          message: "AI crawler access is not permitted on this service.",
        });
      }
      if (config.ai.robotsEnforcement && isAiRobotsViolation(path)) {
        logAuditOnce(
          event,
          {
            action: AuditActions.AI_ROBOTS_VIOLATION,
            entityType: "ip",
            entityId: ip,
            newValues: { path, category, agent: cls.agentDef.name },
          },
          { key: ip },
        );
        throw createError({
          statusCode: 403,
          statusMessage: "Forbidden",
          message: "This path is disallowed for AI crawlers by robots.txt.",
        });
      }
      if (policy === "throttle") aiThrottle = true;
    }

    // 4. Layered rate limiting (skipped for the allow list).
    if (config.rateLimitEnabled && !onAllowList) {
      let multiplier = 1;
      if (enforcement?.type === "THROTTLE") multiplier = config.rl.abusiveMultiplier;
      if (aiThrottle) multiplier = Math.min(multiplier, config.rl.aiThrottleMultiplier);

      const ipResult = await checkRateLimit(storage, {
        key: `ip:${ip}`,
        limit: Math.max(1, Math.floor(config.rl.ipPerMin * multiplier)),
        windowMs: 60_000,
      });
      applyRateLimitHeaders(event, ipResult);
      if (!ipResult.allowed) {
        // Deduped per IP: a sustained flood writes ~one row per minute, not
        // one per rejected request. Logged before the throw so the security
        // event survives even though the request is rejected here.
        logAuditOnce(
          event,
          {
            action: AuditActions.RATE_LIMIT_EXCEEDED,
            entityType: "ip",
            entityId: ip,
            newValues: { scope: "client_ip", path, method },
          },
          { key: ip },
        );
        throwRateLimited(event, ipResult, "client IP");
      }

      const group = classifyRouteGroup(method, path);
      if (group) {
        const groupResult = await checkRateLimit(storage, {
          key: `ip:${ip}:${group.name}`,
          limit: Math.max(1, Math.floor(group.limit * multiplier)),
          windowMs: group.windowMs,
        });
        if (!groupResult.allowed) {
          await createAuditLogOnce(
            event,
            {
              action: AuditActions.RATE_LIMIT_EXCEEDED,
              entityType: "ip",
              entityId: ip,
              newValues: { scope: `${group.name}_routes`, path, method },
            },
            { key: ip },
          );
          throwRateLimited(event, groupResult, `${group.name} routes`);
        }
      }
    }
  } catch (error) {
    // Intentional 403/429 must reach the client; everything else fails open.
    if (isHttpError(error)) throw error;
    console.error("[security] middleware error — failing open:", error);
  }
});
