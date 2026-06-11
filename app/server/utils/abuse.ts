import type { H3Event } from "h3";
import type { Prisma } from "@prisma/client";
import prisma from "./prisma";
import { logAudit, AuditActions } from "./audit";
import { getAnalyticsConfig, type AnalyticsConfig } from "./analytics-config";
import {
  StorageKeys,
  safeGet,
  safeSet,
  safeRemove,
  type KvStorage,
} from "./analytics-storage";

/**
 * Abuse detection: rolling per-IP behaviour scoring and tiered enforcement.
 *
 * Detection runs after each response (in the traffic plugin) and updates a
 * rolling 10-minute window of signals in storage. Enforcement is recorded both
 * as a fast-path storage key (read by the security middleware on the next
 * request) and as durable `AbuseEvent` / `EnforcementAction` rows plus an
 * audit-log entry, so every action surfaces on `/admin/audit-logs`.
 */

/** Rolling detection window. */
export const ABUSE_WINDOW_MS = 10 * 60_000;
const ABUSE_WINDOW_MINUTES = ABUSE_WINDOW_MS / 60_000;

/** Paths that should never legitimately be requested — probing markers. */
const SUSPICIOUS_PATHS = [
  "/.env",
  "/.git",
  "/wp-admin",
  "/wp-login.php",
  "/xmlrpc.php",
  "/phpmyadmin",
  "/administrator",
  "/.aws",
  "/config.json",
  "/.ssh",
  "/admin.php",
  "/shell",
  "/cgi-bin",
  "/vendor/phpunit",
  "/.well-known/security.txt",
  "/server-status",
  "/actuator",
];

/** True when a path is a known scanner/probe target. */
export function isSuspiciousPath(path: string): boolean {
  const clean = (path.split("?")[0] || "").toLowerCase();
  if (clean === "/.well-known/security.txt") return false; // legitimate
  return SUSPICIOUS_PATHS.some((p) => clean === p || clean.startsWith(`${p}/`) || clean.startsWith(`${p}.`));
}

export interface AbuseStats {
  windowStart: number;
  requests: number;
  clientErrors: number;
  authErrors: number;
  notFound: number;
  distinct404: string[];
  suspiciousHits: number;
  failedLogins: number;
  userAgents: string[];
  countries: string[];
  contentPages: number;
  assetRequests: number;
  lastTier: AbuseTier;
}

export type AbuseTier = "ok" | "log" | "throttle" | "block";

export interface AbuseScore {
  score: number;
  reasons: string[];
}

function emptyStats(now: number): AbuseStats {
  return {
    windowStart: now,
    requests: 0,
    clientErrors: 0,
    authErrors: 0,
    notFound: 0,
    distinct404: [],
    suspiciousHits: 0,
    failedLogins: 0,
    userAgents: [],
    countries: [],
    contentPages: 0,
    assetRequests: 0,
    lastTier: "ok",
  };
}

/**
 * Computes a 0-100 abuse score from a window of request signals. Pure and
 * deterministic — the unit tests exercise this directly.
 */
export function computeAbuseScore(stats: AbuseStats, config: AnalyticsConfig): AbuseScore {
  const reasons: string[] = [];
  let score = 0;
  const { abuse } = config;

  const perMin = stats.requests / ABUSE_WINDOW_MINUTES;
  if (perMin > abuse.floodPerMin) {
    score += 40;
    reasons.push(`request flooding (${perMin.toFixed(0)}/min)`);
  } else if (perMin > abuse.floodPerMin / 2) {
    score += 20;
    reasons.push(`elevated request rate (${perMin.toFixed(0)}/min)`);
  }

  if (stats.requests >= 20) {
    const errorRate = stats.clientErrors / stats.requests;
    if (errorRate > abuse.errorRate) {
      score += 25;
      reasons.push(`high 4xx rate (${(errorRate * 100).toFixed(0)}%)`);
    }
  }

  if (stats.authErrors >= 20) {
    score += 20;
    reasons.push(`endpoint probing (${stats.authErrors} x 401/403)`);
  }

  if (stats.failedLogins >= abuse.failedLogins) {
    score += 30;
    reasons.push(`repeated failed logins (${stats.failedLogins})`);
  }

  if (stats.distinct404.length >= abuse.distinct404) {
    score += 25;
    reasons.push(`path scanning (${stats.distinct404.length} distinct 404s)`);
  }

  if (stats.suspiciousHits > 0) {
    score += Math.min(40, stats.suspiciousHits * 20);
    reasons.push(`probing known-vulnerable paths (${stats.suspiciousHits})`);
  }

  if (stats.userAgents.length >= 4) {
    score += 15;
    reasons.push(`user-agent churn (${stats.userAgents.length} UAs)`);
  }

  if (stats.countries.length >= 3) {
    score += 15;
    reasons.push(`geo churn (${stats.countries.length} countries)`);
  }

  return { score: Math.min(100, score), reasons };
}

/**
 * Maps a score onto a response tier using the two configured thresholds:
 * `>= abusiveScore` blocks, the midpoint throttles, `>= suspiciousScore` logs.
 */
export function tierForScore(score: number, config = getAnalyticsConfig()): AbuseTier {
  const { suspiciousScore, abusiveScore } = config.abuse;
  if (score >= abusiveScore) return "block";
  if (score >= suspiciousScore + (abusiveScore - suspiciousScore) / 2) return "throttle";
  if (score >= suspiciousScore) return "log";
  return "ok";
}

function severityForScore(score: number, config: AnalyticsConfig): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  if (score >= 90) return "CRITICAL";
  if (score >= config.abuse.abusiveScore) return "HIGH";
  if (score >= config.abuse.suspiciousScore) return "MEDIUM";
  return "LOW";
}

export interface AbuseRequestSignal {
  ip: string;
  method: string;
  path: string;
  statusCode: number;
  userAgent: string | null;
  country: string | null;
  isContentRoute: boolean;
  isAsset: boolean;
}

export interface AbuseAssessment {
  ip: string;
  stats: AbuseStats;
  score: number;
  reasons: string[];
  tier: AbuseTier;
  /** True when this request pushed the actor to a higher tier than before. */
  escalated: boolean;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

function pushCapped(list: string[], value: string, cap: number): void {
  if (!list.includes(value)) {
    list.push(value);
    if (list.length > cap) list.shift();
  }
}

const TIER_RANK: Record<AbuseTier, number> = { ok: 0, log: 1, throttle: 2, block: 3 };

/**
 * Records one request against an IP's rolling abuse window and returns the
 * resulting assessment. Storage-only (no DB) so it is unit-testable.
 */
export async function recordRequest(
  storage: KvStorage,
  signal: AbuseRequestSignal,
  config = getAnalyticsConfig(),
): Promise<AbuseAssessment> {
  const now = Date.now();
  const key = StorageKeys.abuseStats(signal.ip);

  let stats = await safeGet<AbuseStats>(storage, key);
  if (!stats || now - stats.windowStart >= ABUSE_WINDOW_MS) {
    stats = emptyStats(now);
  }

  stats.requests++;
  if (signal.statusCode >= 400 && signal.statusCode < 500) stats.clientErrors++;
  if (signal.statusCode === 401 || signal.statusCode === 403) stats.authErrors++;
  if (signal.statusCode === 404) {
    stats.notFound++;
    pushCapped(stats.distinct404, (signal.path.split("?")[0] || "").slice(0, 120), 50);
  }
  if (isSuspiciousPath(signal.path)) stats.suspiciousHits++;
  if (
    signal.method.toUpperCase() === "POST"
    && signal.path.startsWith("/api/auth/login")
    && (signal.statusCode === 401 || signal.statusCode === 400)
  ) {
    stats.failedLogins++;
  }
  if (signal.userAgent) pushCapped(stats.userAgents, signal.userAgent.slice(0, 80), 10);
  if (signal.country) pushCapped(stats.countries, signal.country, 10);
  if (signal.isContentRoute) stats.contentPages++;
  if (signal.isAsset) stats.assetRequests++;

  const { score, reasons } = computeAbuseScore(stats, config);
  const tier = tierForScore(score, config);
  const escalated = TIER_RANK[tier] > TIER_RANK[stats.lastTier];
  stats.lastTier = tier;

  await safeSet(storage, key, stats, Math.ceil(ABUSE_WINDOW_MS / 1000));

  return {
    ip: signal.ip,
    stats,
    score,
    reasons,
    tier,
    escalated,
    severity: severityForScore(score, config),
  };
}

// ----------------------------------------------------------------------------
// Enforcement state (storage fast-path)
// ----------------------------------------------------------------------------

export interface EnforcementState {
  type: "THROTTLE" | "BLOCK";
  reason: string;
  expiresAt: number;
  source: "system" | "manual";
}

/** Reads the active enforcement for an IP, treating expired state as absent. */
export async function getEnforcement(storage: KvStorage, ip: string): Promise<EnforcementState | null> {
  const state = await safeGet<EnforcementState>(storage, StorageKeys.enforcement(ip));
  if (!state) return null;
  if (state.expiresAt <= Date.now()) {
    await safeRemove(storage, StorageKeys.enforcement(ip));
    return null;
  }
  return state;
}

/** Writes an enforcement state with a TTL matching its expiry. */
export async function setEnforcement(storage: KvStorage, ip: string, state: EnforcementState): Promise<void> {
  const ttl = Math.max(1, Math.ceil((state.expiresAt - Date.now()) / 1000));
  await safeSet(storage, StorageKeys.enforcement(ip), state, ttl);
}

/** Clears any enforcement state for an IP. */
export async function clearEnforcement(storage: KvStorage, ip: string): Promise<void> {
  await safeRemove(storage, StorageKeys.enforcement(ip));
}

// ----------------------------------------------------------------------------
// Durable persistence (DB + audit) — not exercised by unit tests
// ----------------------------------------------------------------------------

/**
 * Persists an escalation: sets the enforcement fast-path key, writes the
 * `AbuseEvent` + `EnforcementAction` rows, and records an audit-log entry so
 * the action appears on `/admin/audit-logs`. Fail-open.
 */
export async function persistAbuseEscalation(
  event: H3Event,
  assessment: AbuseAssessment,
  context: { ipHash: string; ipTruncated: string | null; userId: string | null; path: string; userAgent: string | null },
): Promise<void> {
  const config = getAnalyticsConfig();
  try {
    const storage = useStorage("analytics") as unknown as KvStorage;
    const category = assessment.reasons[0] ?? "abuse signal";

    const abuseEvent = await prisma.abuseEvent.create({
      data: {
        actorType: "IP",
        actorKey: context.ipHash,
        ipHash: context.ipHash,
        ipTruncated: context.ipTruncated,
        userId: context.userId ?? undefined,
        category: assessment.reasons.join("; ").slice(0, 60) || "abuse",
        severity: assessment.severity,
        score: assessment.score,
        signals: { reasons: assessment.reasons, tier: assessment.tier } as Prisma.InputJsonValue,
        userAgent: context.userAgent ?? undefined,
        path: context.path,
      },
    });

    let enforcementType: "LOG_ONLY" | "THROTTLE" | "BLOCK" = "LOG_ONLY";
    let auditAction: string = AuditActions.ABUSE_DETECTED;
    let expiresAt: Date | null = null;

    if (assessment.tier === "throttle") {
      enforcementType = "THROTTLE";
      auditAction = AuditActions.ABUSE_THROTTLE_APPLIED;
      expiresAt = new Date(Date.now() + config.abuse.blockMinutes * 60_000);
      await setEnforcement(storage, assessment.ip, {
        type: "THROTTLE",
        reason: category,
        expiresAt: expiresAt.getTime(),
        source: "system",
      });
    } else if (assessment.tier === "block") {
      enforcementType = "BLOCK";
      auditAction = AuditActions.ABUSE_BLOCK_APPLIED;
      expiresAt = new Date(Date.now() + config.abuse.blockMinutes * 60_000);
      await setEnforcement(storage, assessment.ip, {
        type: "BLOCK",
        reason: category,
        expiresAt: expiresAt.getTime(),
        source: "system",
      });
    }

    await prisma.enforcementAction.create({
      data: {
        abuseEventId: abuseEvent.id,
        actorType: "IP",
        actorKey: context.ipHash,
        type: enforcementType,
        reason: assessment.reasons.join("; ").slice(0, 500) || "abuse detected",
        appliedById: null,
        expiresAt: expiresAt ?? undefined,
      },
    });

    logAudit(event, {
      userId: context.userId ?? undefined,
      action: auditAction,
      entityType: "abuse_event",
      entityId: abuseEvent.id,
      newValues: {
        score: assessment.score,
        tier: assessment.tier,
        severity: assessment.severity,
        reasons: assessment.reasons,
        ipTruncated: context.ipTruncated,
      },
    });
  } catch (error) {
    console.error("[abuse] failed to persist escalation:", error);
  }
}

/**
 * Records a discrete AI-related abuse event (spoofed identity, cloaked
 * scraper, robots.txt violation) with its own audit entry. Fail-open.
 */
export async function recordAiAbuseEvent(
  event: H3Event,
  params: {
    category: "AI_SPOOFED" | "AI_CLOAKED" | "ROBOTS_VIOLATION";
    ipHash: string;
    ipTruncated: string | null;
    userId: string | null;
    path: string;
    userAgent: string | null;
    provider: string | null;
    signals: Record<string, unknown>;
  },
): Promise<void> {
  const severity = params.category === "AI_SPOOFED" ? "HIGH" : "MEDIUM";
  const auditAction
    = params.category === "AI_SPOOFED"
      ? AuditActions.AI_AGENT_SPOOFED
      : params.category === "ROBOTS_VIOLATION"
        ? AuditActions.AI_ROBOTS_VIOLATION
        : AuditActions.ABUSE_DETECTED;
  try {
    const abuseEvent = await prisma.abuseEvent.create({
      data: {
        actorType: "IP",
        actorKey: params.ipHash,
        ipHash: params.ipHash,
        ipTruncated: params.ipTruncated,
        userId: params.userId ?? undefined,
        category: params.category,
        severity,
        score: severity === "HIGH" ? 80 : 50,
        signals: { ...params.signals, provider: params.provider } as Prisma.InputJsonValue,
        userAgent: params.userAgent ?? undefined,
        path: params.path,
      },
    });
    logAudit(event, {
      userId: params.userId ?? undefined,
      action: auditAction,
      entityType: "abuse_event",
      entityId: abuseEvent.id,
      newValues: { ...params.signals, provider: params.provider, path: params.path },
    });
  } catch (error) {
    console.error("[abuse] failed to record AI abuse event:", error);
  }
}
