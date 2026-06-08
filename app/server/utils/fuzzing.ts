import type { H3Event } from "h3";
import type { Prisma } from "@prisma/client";
import prisma from "./prisma";
import { createAuditLog, AuditActions } from "./audit";
import { isSuspiciousPath } from "./abuse";
import { safeGet, safeSet, type KvStorage } from "./analytics-storage";

/**
 * Fuzzing detection: classify a finished request as a probing/fuzzing attempt
 * and persist it.
 *
 * Unlike abuse scoring — which only writes an `AbuseEvent` once an IP crosses a
 * tier threshold — every classified attempt is recorded as its own
 * `FuzzingAttempt` row so the admin Fuzzing analytics tab shows the full
 * picture (malformed form submissions, probed URLs, suspicious paths, auth /
 * param fuzzing). Detection runs in the traffic plugin's `afterResponse` hook,
 * so it adds no user-facing latency. Fail-open throughout.
 */

export type FuzzingCategory =
  | "SUSPICIOUS_PATH"
  | "AUTH_FUZZING"
  | "FORM_VALIDATION"
  | "PARAM_TAMPERING"
  | "PATH_PROBE";

export type FuzzingSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/** Validation-failure metadata stashed on the request context by
 * `validateBody` — only field NAMES are kept, never submitted values. */
export interface FuzzingValidationContext {
  validationFailed?: boolean;
  fields?: string[];
}

export interface FuzzingSignal {
  method: string;
  path: string;
  statusCode: number;
  isApi: boolean;
  validation?: FuzzingValidationContext | null;
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

  // Repeated bad logins — credential fuzzing / brute force.
  if (
    signal.path.startsWith("/api/auth/login")
    && method === "POST"
    && (status === 400 || status === 401)
  ) {
    return { category: "AUTH_FUZZING", severity: "MEDIUM" };
  }

  // Malformed form/payload submission caught by Zod validation.
  if (WRITE_METHODS.has(method) && status === 400 && signal.validation?.validationFailed) {
    return { category: "FORM_VALIDATION", severity: "MEDIUM" };
  }

  // URL guessing / endpoint scanning.
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

    if (ctx.severity === "HIGH" || ctx.severity === "CRITICAL") {
      const storage = useStorage("analytics") as unknown as KvStorage;
      const dedupeKey = `audit:fuzz:${ctx.ipHash}`;
      if (!(await safeGet<boolean>(storage, dedupeKey))) {
        await safeSet(storage, dedupeKey, true, 600);
        await createAuditLog(event, {
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
