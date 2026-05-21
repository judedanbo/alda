import { randomUUID } from "node:crypto";
import type { AiCategory } from "@prisma/client";
import prisma from "~/server/utils/prisma";
import { getAnalyticsConfig, isExcludedPath } from "~/server/utils/analytics-config";
import {
  extractClientIp,
  hashIp,
  truncateIp,
  deriveCountry,
  getRequestId,
  hasDoNotTrack,
  isPrivateIp,
  routePatternFromPath,
} from "~/server/utils/request-meta";
import { parseUserAgent } from "~/server/utils/user-agent";
import {
  classifyVisitor,
  detectCloakedScraper,
  isAiRobotsViolation,
  policyForAiCategory,
} from "~/server/utils/ai-agents";
import {
  getAnalyticsStorage,
  StorageKeys,
  safeGet,
  safeSet,
  type KvStorage,
} from "~/server/utils/analytics-storage";
import {
  enqueueTrafficEvent,
  startTrafficBufferTimer,
  stopTrafficBufferTimer,
} from "~/server/utils/traffic-buffer";
import {
  recordRequest,
  persistAbuseEscalation,
  recordAiAbuseEvent,
} from "~/server/utils/abuse";
import { createAuditLog, AuditActions } from "~/server/utils/audit";
import type { AnalyticsRequestContext } from "~/server/utils/analytics-context";

/**
 * Traffic capture plugin.
 *
 * The `request` hook runs before any middleware: it parses the User-Agent
 * once, classifies the visitor, performs anonymous-visitor sessionization and
 * stores everything on `event.context.analytics`. The `afterResponse` hook —
 * which runs after the response has already been sent, so it adds zero
 * user-facing latency — captures the finished request as a traffic event,
 * feeds the abuse scorer and records AI-related abuse. Every step is wrapped
 * fail-open: an analytics failure can never break or slow a real request.
 */

const VISITOR_COOKIE = "adla_vid";
const SESSION_COOKIE = "adla_sid";

function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: maxAgeSeconds,
  };
}

/** True the first time a marker key is seen within `ttl` seconds. */
async function recordOnce(storage: KvStorage, key: string, ttl: number): Promise<boolean> {
  const seen = await safeGet<boolean>(storage, key);
  if (seen) return false;
  await safeSet(storage, key, true, ttl);
  return true;
}

/** Extracts the bare host of a Referer header, or `null` when absent/invalid. */
function referrerHost(referer: string | null): string | null {
  if (!referer) return null;
  try {
    return new URL(referer).hostname.slice(0, 255);
  } catch {
    return null;
  }
}

function estimateBytes(event: Parameters<typeof getResponseHeader>[0], body: unknown): number {
  const header = getResponseHeader(event, "content-length");
  if (header) {
    const n = Number(header);
    if (Number.isFinite(n)) return n;
  }
  try {
    if (typeof body === "string") return Buffer.byteLength(body);
    if (body instanceof Uint8Array) return body.byteLength;
    if (body && typeof body === "object") return Buffer.byteLength(JSON.stringify(body));
  } catch {
    // ignore — size is best-effort
  }
  return 0;
}

export default defineNitroPlugin((nitroApp) => {
  const config = getAnalyticsConfig();
  if (!config.enabled) return;

  startTrafficBufferTimer();

  // Re-hydrate operator allow/block rules into storage on boot so they survive
  // a restart even when the in-memory storage driver is in use.
  void (async () => {
    try {
      const storage = getAnalyticsStorage();
      const rules = await prisma.actorAccessRule.findMany({
        where: { active: true, actorType: "IP" },
      });
      for (const rule of rules) {
        if (rule.expiresAt && rule.expiresAt.getTime() <= Date.now()) continue;
        const ttl = rule.expiresAt
          ? Math.max(1, Math.ceil((rule.expiresAt.getTime() - Date.now()) / 1000))
          : undefined;
        const key = rule.ruleType === "BLOCK"
          ? StorageKeys.block("ip", rule.actorValue)
          : StorageKeys.allow("ip", rule.actorValue);
        await safeSet(storage, key, { reason: rule.reason, ruleId: rule.id }, ttl);
      }
    } catch (error) {
      console.error("[traffic] access-rule rehydration failed:", error);
    }
  })();

  // --- request start: sessionization + classification --------------------
  nitroApp.hooks.hook("request", (event) => {
    try {
      const path = getRequestURL(event).pathname;
      const now = Date.now();

      if (isExcludedPath(path, config)) {
        event.context.analytics = { excluded: true, startTime: now } as AnalyticsRequestContext;
        return;
      }

      const ip = extractClientIp(event);
      const uaString = getHeader(event, "user-agent") ?? "";
      const dnt = config.respectDnt && hasDoNotTrack(event);

      // Anonymous visitor id — suppressed under Do-Not-Track (no cross-visit id).
      let visitorId = getCookie(event, VISITOR_COOKIE) ?? null;
      let isNewVisitor = false;
      if (!visitorId && !dnt) {
        visitorId = randomUUID();
        isNewVisitor = true;
        setCookie(event, VISITOR_COOKIE, visitorId, cookieOptions(365 * 24 * 3600));
      }

      // Session id — rolling inactivity window; always set (security-essential).
      let sessionId = getCookie(event, SESSION_COOKIE) ?? null;
      let isNewSession = false;
      if (!sessionId) {
        sessionId = randomUUID();
        isNewSession = true;
      }
      setCookie(event, SESSION_COOKIE, sessionId, cookieOptions(config.sessionWindowMinutes * 60));

      event.context.analytics = {
        excluded: false,
        startTime: now,
        ip,
        ipHash: hashIp(ip, config.ipSalt),
        ipTruncated: truncateIp(ip),
        country: deriveCountry(event),
        requestId: getRequestId(event),
        visitorId,
        sessionId,
        isNewVisitor,
        isNewSession,
        dnt,
        ua: parseUserAgent(uaString),
        classification: classifyVisitor(uaString),
        aiVerified: null,
      };
    } catch (error) {
      console.error("[traffic] request hook failed:", error);
    }
  });

  // --- after response: capture + abuse scoring ---------------------------
  nitroApp.hooks.hook("afterResponse", async (event, response) => {
    const actx = event.context.analytics;
    if (!actx || actx.excluded) return;
    if (!config.captureEnabled) return;

    try {
      const url = getRequestURL(event);
      const path = url.pathname;
      const method = (event.method || "GET").toUpperCase();
      const status = getResponseStatus(event) || 200;
      const duration = Math.max(0, Date.now() - actx.startTime);
      const bytes = estimateBytes(event, (response as { body?: unknown } | undefined)?.body);
      const isApi = path.startsWith("/api/");
      const isContentRoute = !isApi;
      const storage = getAnalyticsStorage();
      const auth = event.context.auth;
      const userAgent = getHeader(event, "user-agent") ?? null;
      const referer = actx.dnt ? null : (getHeader(event, "referer") ?? null);

      let classification = actx.classification;
      let aiVerified = actx.aiVerified;

      // Resolve the cached AI verification verdict for declared AI agents.
      if (config.aiDetectionEnabled && classification.visitorClass === "AI_AGENT" && !aiVerified) {
        aiVerified = await safeGet(storage, StorageKeys.aiVerify(actx.ip));
      }

      // Behavioural cloaked-scraper detection for non-declared visitors.
      if (
        config.aiDetectionEnabled
        && classification.visitorClass !== "AI_AGENT"
        && classification.visitorClass !== "SEARCH_BOT"
      ) {
        const cloaked = detectCloakedScraper({
          browser: actx.ua.browser,
          isBot: actx.ua.isBot,
          isDeclaredAgent: false,
          hasCookies: !!getHeader(event, "cookie"),
          acceptsHtml: (getHeader(event, "accept") || "").includes("text/html"),
          hasBrowserHeaders: !!(getHeader(event, "accept-language") || getHeader(event, "sec-fetch-mode")),
          isContentRoute,
          isDatacenterIp: !isPrivateIp(actx.ip) && actx.ip !== "unknown",
          userAgent: userAgent || "",
        });
        if (cloaked.cloaked) {
          classification = {
            ...classification,
            visitorClass: "AI_AGENT",
            aiProvider: "Undisclosed",
            aiCategory: "UNKNOWN_SCRAPER",
            aiAgentName: "Undisclosed scraper",
          };
          if (config.abuseEnabled && await recordOnce(storage, `aiabuse:cloak:${actx.ip}`, 600)) {
            await recordAiAbuseEvent(event, {
              category: "AI_CLOAKED",
              ipHash: actx.ipHash,
              ipTruncated: actx.ipTruncated,
              userId: auth?.userId ?? null,
              path,
              userAgent,
              provider: "Undisclosed",
              signals: { reasons: cloaked.reasons },
            });
          }
        }
      }

      enqueueTrafficEvent({
        occurredAt: new Date(actx.startTime),
        method: method.slice(0, 10),
        path: path.slice(0, 1024),
        routePattern: routePatternFromPath(path),
        statusCode: status,
        durationMs: duration,
        responseBytes: bytes,
        referrer: referer?.slice(0, 1024) ?? null,
        referrerHost: referrerHost(referer),
        userAgent: userAgent?.slice(0, 1024) ?? null,
        browser: actx.ua.browser,
        os: actx.ua.os,
        deviceType: actx.ua.deviceType,
        isBot: classification.isBot,
        visitorClass: classification.visitorClass,
        aiProvider: classification.aiProvider,
        aiCategory: (classification.aiCategory as AiCategory | null) ?? null,
        aiVerified,
        ipHash: actx.ipHash,
        ipTruncated: actx.ipTruncated,
        country: actx.country,
        userId: auth?.userId ?? null,
        userRole: auth?.roles?.[0] ?? null,
        sessionId: actx.sessionId,
        visitorId: actx.visitorId,
        isNewVisitor: actx.isNewVisitor,
        isNewSession: actx.isNewSession,
        requestId: actx.requestId,
      });

      // Abuse scoring — escalations are persisted (DB + audit) once per tier.
      if (config.abuseEnabled) {
        const assessment = await recordRequest(storage, {
          ip: actx.ip,
          method,
          path,
          statusCode: status,
          userAgent,
          country: actx.country,
          isContentRoute,
          isAsset: false,
        });
        if (assessment.escalated && assessment.tier !== "ok") {
          await persistAbuseEscalation(event, assessment, {
            ipHash: actx.ipHash,
            ipTruncated: actx.ipTruncated,
            userId: auth?.userId ?? null,
            path,
            userAgent,
          });
        }
      }

      // AI-specific abuse: spoofed identity and robots.txt violations.
      if (config.aiDetectionEnabled && actx.classification.visitorClass === "AI_AGENT") {
        if (aiVerified === "spoofed" && await recordOnce(storage, `aiabuse:spoof:${actx.ip}`, 600)) {
          await recordAiAbuseEvent(event, {
            category: "AI_SPOOFED",
            ipHash: actx.ipHash,
            ipTruncated: actx.ipTruncated,
            userId: auth?.userId ?? null,
            path,
            userAgent,
            provider: actx.classification.aiProvider,
            signals: { agent: actx.classification.aiAgentName, verdict: aiVerified },
          });
        }
        if (
          config.ai.robotsEnforcement
          && isAiRobotsViolation(path)
          && await recordOnce(storage, `aiabuse:robots:${actx.ip}`, 600)
        ) {
          await recordAiAbuseEvent(event, {
            category: "ROBOTS_VIOLATION",
            ipHash: actx.ipHash,
            ipTruncated: actx.ipTruncated,
            userId: auth?.userId ?? null,
            path,
            userAgent,
            provider: actx.classification.aiProvider,
            signals: { agent: actx.classification.aiAgentName, category: actx.classification.aiCategory },
          });
        }
      }

      // Deduplicated audit entries for enforcement outcomes.
      if (status === 429 && await recordOnce(storage, `audit:rl:${actx.ip}`, 300)) {
        await createAuditLog(event, {
          userId: auth?.userId ?? undefined,
          action: AuditActions.RATE_LIMIT_EXCEEDED,
          entityType: "traffic",
          newValues: { path, method, ipTruncated: actx.ipTruncated },
        });
      }
      if (status === 403 && actx.classification.visitorClass === "AI_AGENT") {
        const policy = policyForAiCategory(actx.classification.aiCategory ?? "UNKNOWN_SCRAPER");
        if (
          (policy === "block" || aiVerified === "spoofed")
          && await recordOnce(storage, `audit:aiblock:${actx.ip}`, 600)
        ) {
          await createAuditLog(event, {
            userId: auth?.userId ?? undefined,
            action: AuditActions.AI_AGENT_BLOCKED,
            entityType: "traffic",
            newValues: {
              provider: actx.classification.aiProvider,
              category: actx.classification.aiCategory,
              path,
              ipTruncated: actx.ipTruncated,
            },
          });
        }
      }
    } catch (error) {
      console.error("[traffic] afterResponse hook failed:", error);
    }
  });

  // Flush any buffered events on shutdown.
  nitroApp.hooks.hook("close", async () => {
    await stopTrafficBufferTimer();
  });
});
