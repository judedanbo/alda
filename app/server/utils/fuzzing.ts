import type { H3Event } from "h3";
import type { Prisma } from "@prisma/client";
import prisma from "./prisma";
import { logAudit, AuditActions } from "./audit";
import { isSuspiciousPath } from "./abuse";
import { safeGet, safeSet, type KvStorage } from "./analytics-storage";
import type { FuzzingRequestContext } from "./analytics-context";

/**
 * Fuzzing detection: classify a finished request as a probing/fuzzing attempt
 * and persist it.
 *
 * Two-stage design (see review of the original single-stage version):
 *  1. SCOPE (classifyFuzzingAttempt, pure): high-signal probes — known-
 *     vulnerable paths and failed logins — are always classified. The lower-
 *     signal categories (form validation, 404 path probes, param tampering) are
 *     scoped to UNAUTHENTICATED API callers only, so a logged-in user's mistake
 *     or a broken content-route link is never treated as an attack.
 *  2. GATE (recordFuzzingAttempt, stateful): suspicious-path probes persist on
 *     the first hit; all other categories must REPEAT within a window before a
 *     row is written (shouldPersistAttempt). This keeps the table to genuine
 *     offenders and caps write volume under a flood.
 *
 * Detection runs in the traffic plugin's `afterResponse` hook, so it adds no
 * user-facing latency. Fail-open throughout.
 */

export type FuzzingCategory =
  | "SUSPICIOUS_PATH"
  | "AUTH_FUZZING"
  | "FORM_VALIDATION"
  | "PARAM_TAMPERING"
  | "PATH_PROBE";

export type FuzzingSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface FuzzingSignal {
  method: string;
  path: string;
  statusCode: number;
  isApi: boolean;
  /** True when the request carried a valid JWT for a real account. A logged-in
   * user hitting a 400/404 is product friction, not anonymous probing, so the
   * lower-signal categories are scoped out for authenticated callers. */
  authenticated: boolean;
  /** Validation-failure metadata stashed on the request context by
   * `validateBody` (field NAMES only, never submitted values). Single source of
   * truth lives in analytics-context.ts as the `event.context.fuzzing` shape. */
  validation?: FuzzingRequestContext | null;
}

export interface FuzzingClassification {
  category: FuzzingCategory;
  severity: FuzzingSeverity;
}

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH"]);

/**
 * Classifies a finished request as a fuzzing attempt, or returns `null` when it
 * is benign. Pure and deterministic — exercised directly by the unit tests.
 * First match wins (highest-signal categories are checked first).
 */
export function classifyFuzzingAttempt(signal: FuzzingSignal): FuzzingClassification | null {
  const method = signal.method.toUpperCase();
  const status = signal.statusCode;

  // Probing known-vulnerable paths is the strongest signal, regardless of
  // status (the path itself is the tell).
  if (isSuspiciousPath(signal.path)) {
    return { category: "SUSPICIOUS_PATH", severity: "HIGH" };
  }

  // Credential fuzzing / brute force. A single failed login is an honest typo;
  // the rate gate in recordFuzzingAttempt requires repetition before this is
  // persisted, so a one-off bad password never lands in the table.
  if (
    signal.path.startsWith("/api/auth/login")
    && method === "POST"
    && (status === 400 || status === 401)
  ) {
    return { category: "AUTH_FUZZING", severity: "MEDIUM" };
  }

  // The remaining categories are only meaningful for UNAUTHENTICATED callers on
  // API routes. A logged-in user's 400/404 is product friction (an attacker
  // would have to burn a real account, which abuse scoring catches separately),
  // and content-route 404s are overwhelmingly broken links / stale bookmarks /
  // asset misses, not endpoint enumeration. Scope both out at the source.
  if (signal.authenticated || !signal.isApi) {
    return null;
  }

  // Malformed form/payload submission caught by Zod validation.
  if (WRITE_METHODS.has(method) && status === 400 && signal.validation?.validationFailed) {
    return { category: "FORM_VALIDATION", severity: "MEDIUM" };
  }

  // API endpoint guessing / scanning.
  if (status === 404) {
    return { category: "PATH_PROBE", severity: "LOW" };
  }

  // Bad ids / tampered query params or other malformed input (422, or a 400
  // not already attributed to a known form validation failure).
  if (status === 422 || status === 400) {
    return { category: "PARAM_TAMPERING", severity: "LOW" };
  }

  return null;
}

// ----------------------------------------------------------------------------
// Rate gate — only persist actors that REPEAT
// ----------------------------------------------------------------------------

/** Sliding window over which a single actor's classified attempts are counted
 * before the rate gate decides to persist. Mirrors the abuse subsystem's
 * windowed-stats pattern (read-modify-write a small object with a matching TTL). */
const FUZZING_GATE_WINDOW_MS = 10 * 60_000;

interface AttemptWindow {
  windowStart: number;
  count: number;
}

/**
 * Increments and returns this actor's classified-attempt count in the current
 * window (including the current attempt, so the first call returns 1). Read-
 * modify-write against the analytics KV; fail-open to 1 so a storage blip never
 * suppresses persistence.
 */
async function bumpActorAttemptCount(storage: KvStorage, ipHash: string): Promise<number> {
  try {
    const key = `fuzz:gate:${ipHash}`;
    const now = Date.now();
    let w = await safeGet<AttemptWindow>(storage, key);
    if (!w || now - w.windowStart >= FUZZING_GATE_WINDOW_MS) {
      w = { windowStart: now, count: 0 };
    }
    w.count++;
    await safeSet(storage, key, w, Math.ceil(FUZZING_GATE_WINDOW_MS / 1000));
    return w.count;
  } catch {
    return 1;
  }
}

/**
 * Rate gate: decides whether a LOW/MEDIUM classified attempt should be
 * PERSISTED. (HIGH/CRITICAL bypass this entirely — see recordFuzzingAttempt —
 * because a known-vulnerable-path probe is worth recording on the first hit.)
 *
 * `count` is the number of classified attempts from this actor in the current
 * ~10-minute window, INCLUDING the current one (first attempt → count === 1).
 *
 * The goal of the gate is signal quality: a single honest mistake — one bad
 * form submit, one mistyped password, one stale-link 404 — must NOT create a
 * row or brand a user an "offender". Only actors that REPEAT should persist.
 *
 * Trade-offs to weigh when you pick the policy:
 *  - Higher threshold  → fewer false positives, but a low-and-slow prober and
 *    the first few real probes go unrecorded. The gate is LOSSY: attempts below
 *    the threshold are dropped, not backfilled once the actor crosses it.
 *  - MEDIUM (auth/form fuzzing) is a stronger signal than LOW (404 / param
 *    tampering), so you may want a lower threshold for MEDIUM than for LOW.
 *  - Whatever you choose also caps write volume under a flood (review finding
 *    #2), since dropped attempts never hit the database.
 *
 * Return true to persist this attempt, false to drop it.
 *
 * The thresholds below are the two tuning knobs — adjust them to taste. The
 * higher-signal MEDIUM categories (auth / form fuzzing) require fewer repeats
 * than the noisier LOW ones (404 probes, param tampering).
 */
const PERSIST_THRESHOLD: Record<FuzzingSeverity, number> = {
  CRITICAL: 1, // bypassed by caller, listed for completeness
  HIGH: 1, //     bypassed by caller, listed for completeness
  MEDIUM: 3, // ← knob: repeats before an auth/form-fuzzing actor is recorded
  LOW: 5, //     ← knob: repeats before a 404/param-tampering actor is recorded
};

export function shouldPersistAttempt(severity: FuzzingSeverity, count: number): boolean {
  return count >= PERSIST_THRESHOLD[severity];
}

export interface FuzzingRecordContext {
  category: FuzzingCategory;
  severity: FuzzingSeverity;
  method: string;
  path: string;
  routePattern: string;
  statusCode: number;
  ipHash: string;
  ipTruncated: string | null;
  country: string | null;
  userAgent: string | null;
  visitorClass: "HUMAN" | "SEARCH_BOT" | "AI_AGENT" | "OTHER_BOT";
  userId: string | null;
  userRole: string | null;
  sessionId: string | null;
  visitorId: string | null;
  requestId: string | null;
  details: Record<string, unknown> | null;
}

/**
 * Persists one fuzzing attempt. HIGH-severity attempts (suspicious-path probes)
 * also write a deduplicated audit-log entry so they surface on
 * `/admin/audit-logs`; lower-severity categories are recorded only in
 * `fuzzing_attempts` to avoid flooding the audit log. Fail-open.
 */
export async function recordFuzzingAttempt(event: H3Event, ctx: FuzzingRecordContext): Promise<void> {
  try {
    const isHigh = ctx.severity === "HIGH" || ctx.severity === "CRITICAL";
    const storage = useStorage("analytics") as unknown as KvStorage;

    // Rate gate for lower-severity categories: only persist actors that repeat,
    // so one honest mistake never creates a row (and a flood can't amplify into
    // unbounded writes). HIGH/CRITICAL (suspicious-path probes) bypass and are
    // always recorded on the first hit.
    if (!isHigh) {
      const count = await bumpActorAttemptCount(storage, ctx.ipHash);
      if (!shouldPersistAttempt(ctx.severity, count)) return;
    }

    await prisma.fuzzingAttempt.create({
      data: {
        category: ctx.category,
        severity: ctx.severity,
        method: ctx.method.slice(0, 10),
        path: ctx.path.slice(0, 1024),
        routePattern: ctx.routePattern.slice(0, 255),
        statusCode: ctx.statusCode,
        ipHash: ctx.ipHash,
        ipTruncated: ctx.ipTruncated ?? undefined,
        country: ctx.country ?? undefined,
        userAgent: ctx.userAgent?.slice(0, 1024) ?? undefined,
        visitorClass: ctx.visitorClass,
        userId: ctx.userId ?? undefined,
        userRole: ctx.userRole ?? undefined,
        sessionId: ctx.sessionId ?? undefined,
        visitorId: ctx.visitorId ?? undefined,
        requestId: ctx.requestId ?? undefined,
        details: (ctx.details ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });

    if (isHigh) {
      // Dedupe per (actor, category) so a multi-target scan (/.env then
      // /.git/config then /.aws/credentials) still produces one audit entry per
      // distinct probe type, instead of collapsing the whole incident into one.
      const dedupeKey = `audit:fuzz:${ctx.ipHash}:${ctx.category}`;
      if (!(await safeGet<boolean>(storage, dedupeKey))) {
        await safeSet(storage, dedupeKey, true, 600);
        logAudit(event, {
          userId: ctx.userId ?? undefined,
          action: AuditActions.FUZZING_DETECTED,
          entityType: "fuzzing_attempt",
          newValues: {
            category: ctx.category,
            severity: ctx.severity,
            method: ctx.method,
            path: ctx.path,
            statusCode: ctx.statusCode,
            ipTruncated: ctx.ipTruncated,
          },
        });
      }
    }
  } catch (error) {
    console.error("[fuzzing] failed to record attempt:", error);
  }
}
