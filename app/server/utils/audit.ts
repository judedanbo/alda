import type { H3Event } from "h3";
import { extractClientIp } from "./request-meta";
import { scrubAuditValues } from "./pii";
import {
  getAnalyticsStorage,
  safeGet,
  safeSet,
  type KvStorage,
} from "./analytics-storage";
import { runAfterResponse } from "./after-response";
import {
  enqueueAuditJob,
  isAuditQueueEnabled,
  processAuditJob,
  type AuditJobData,
} from "./audit-queue";

export interface AuditLogData {
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
}

/**
 * Capture an audit-log event.
 *
 * When the BullMQ audit queue is enabled (Redis configured), the call
 * enqueues a job and returns in microseconds. The worker started by
 * `server/plugins/audit-worker.ts` writes the AuditLog row with up to
 * `maxAttempts` retries; persistent failures land in BullMQ's `failed`
 * set for operator inspection (M-10).
 *
 * When the queue is disabled, or when the enqueue itself throws (Redis
 * outage mid-request), this falls back to writing the row inline via
 * `processAuditJob`. The inline write is best-effort — a failure is
 * console.error-logged but doesn't fail the request, matching the
 * original pre-M-10 behaviour. Production deploys are expected to keep
 * the queue enabled so the durable path is the common case.
 */
export async function createAuditLog(
  event: H3Event,
  data: AuditLogData
): Promise<void> {
  const ipAddress = extractClientIp(event);
  // Request metadata is best-effort: synthetic/internal events (and tests)
  // may lack node.req, and audit logging must never break the operation it
  // records. extractClientIp already tolerates a missing socket.
  let userAgent = "unknown";
  let sessionId: string | undefined;
  try {
    userAgent = getHeader(event, "user-agent") || "unknown";
    sessionId = getCookie(event, "session_id") || undefined;
  } catch {
    // leave defaults
  }

  // Mask known PII fields (Ghana Card numbers, full names, emails, phones,
  // bucket keys) before persisting. Old rows written before C-5 still
  // contain plaintext; new rows do not. See server/utils/pii.ts.
  const scrubbedOld = scrubAuditValues(data.oldValues);
  const scrubbedNew = scrubAuditValues(data.newValues);

  const job: AuditJobData = {
    userId: data.userId,
    action: data.action,
    entityType: data.entityType,
    entityId: data.entityId,
    oldValues: scrubbedOld,
    newValues: scrubbedNew,
    ipAddress,
    userAgent,
    sessionId,
    // Captured here, not in the worker — guarantees AuditLog.createdAt
    // reflects request time even if the worker drains the queue minutes
    // later.
    occurredAt: new Date().toISOString(),
  };

  if (isAuditQueueEnabled()) {
    try {
      await enqueueAuditJob(job);
      return;
    } catch (err) {
      console.error("[audit] queue enqueue failed, falling back to inline write:", err);
    }
  }

  // Inline / fallback path. Best-effort — production should run with the
  // queue enabled so the durable path is the common case.
  try {
    await processAuditJob({ data: job });
  } catch (err) {
    console.error("[audit] inline write failed:", err);
  }
}

/**
 * Write an audit log at most once per `windowSeconds` for a given
 * (action, dedupeKey) pair.
 *
 * Used for high-volume security-enforcement events (rate-limit breaches,
 * AI-agent blocks) fired from middleware: an attacker hammering a blocked
 * route would otherwise flood `audit_logs` with thousands of identical
 * rows per second. The dedup marker lives in the analytics KV (Redis when
 * configured, in-memory otherwise) with a short TTL, so a flood collapses
 * to ~one row per window instead.
 *
 * Returns `true` if a row was written, `false` if suppressed by an
 * existing marker. Fails open to logging: if the KV is unreachable the
 * event is still written (better a duplicate row than a lost security
 * event).
 */
export async function createAuditLogOnce(
  event: H3Event,
  data: AuditLogData,
  dedupe: { key: string; windowSeconds?: number },
): Promise<boolean> {
  let storage: KvStorage | null = null;
  try {
    storage = getAnalyticsStorage();
  } catch {
    storage = null;
  }

  if (storage) {
    const dedupKey = `audit:dedup:${data.action}:${dedupe.key}`;
    if (await safeGet(storage, dedupKey)) return false;
    await safeSet(storage, dedupKey, 1, dedupe.windowSeconds ?? 60);
  }

  await createAuditLog(event, data);
  return true;
}

/**
 * Fire-and-forget audit logging — the response-path default.
 *
 * `createAuditLog` enqueues the job (prod) or writes inline (no Redis) and is
 * `await`ed by callers that need that; but for the common case the HTTP
 * response should not wait on that I/O. `logAudit` invokes `createAuditLog`
 * synchronously — so request metadata (IP / UA / `occurredAt`) is captured at
 * call time — then detaches the returned enqueue/write promise via
 * `runAfterResponse` so the handler returns immediately. The background work is
 * tracked and drained on graceful shutdown (server/plugins/after-response-drain.ts).
 */
export function logAudit(event: H3Event, data: AuditLogData): void {
  runAfterResponse(createAuditLog(event, data), `audit:${data.action}`);
}

/**
 * Detached, deduped variant for high-volume middleware security events
 * (rate-limit breaches, AI-agent blocks). Mirrors `logAudit` but wraps
 * `createAuditLogOnce` so the dedup KV round-trip is also off the response
 * path — the 429/403 is sent without waiting on it.
 */
export function logAuditOnce(
  event: H3Event,
  data: AuditLogData,
  dedupe: { key: string; windowSeconds?: number },
): void {
  runAfterResponse(createAuditLogOnce(event, data, dedupe), `audit:${data.action}`);
}

/**
 * Common audit actions
 */
export const AuditActions = {
  // Authentication
  USER_REGISTERED: "user_registered",
  USER_LOGIN: "user_login",
  USER_LOGOUT: "user_logout",
  USER_LOGIN_FAILED: "user_login_failed",
  REFRESH_TOKEN_REPLAY_DETECTED: "refresh_token_replay_detected",
  PASSWORD_RESET_REQUESTED: "password_reset_requested",
  PASSWORD_RESET_COMPLETED: "password_reset_completed",
  PASSWORD_CHANGED: "password_changed",
  CONTACT_INFO_UPDATED: "contact_info_updated",
  EMAIL_VERIFIED: "email_verified",
  VERIFICATION_RESENT: "verification_resent",
  INVITE_ACCEPTED: "invite_accepted",
  PHONE_CODE_REQUESTED: "phone_code_requested",
  PHONE_VERIFIED: "phone_verified",
  PHONE_VERIFICATION_FAILED: "phone_verification_failed",

  // Profile
  PROFILE_CREATED: "profile_created",
  PROFILE_UPDATED: "profile_updated",

  // ID document uploads
  GHANA_CARD_UPLOADED: "ghana_card_uploaded",
  ALTERNATE_ID_UPLOADED: "alternate_id_uploaded",
  REISSUE_LETTER_UPLOADED: "reissue_letter_uploaded",
  VERIFICATION_DOCUMENT_UPLOADED: "verification_document_uploaded",
  VERIFICATION_DOCUMENT_DELETED: "verification_document_deleted",

  // Offices
  OFFICE_ADDED: "office_added",
  OFFICE_UPDATED: "office_updated",
  OFFICE_REMOVED: "office_removed",
  OFFICE_ASSIGN: "office_assign",

  // User Management
  USER_CREATED: "user_created",
  USER_INVITED: "user_invited",
  USER_UPDATED: "user_updated",
  USER_DELETED: "user_deleted",
  USER_PASSWORD_RESET_SENT: "user_password_reset_sent",

  // Declarations
  DECLARATION_CREATED: "declaration_created",
  FORM_COLLECTION_RECORDED: "form_collection_recorded",
  FORM_RETURNED: "form_returned",
  DECLARATION_SUBMITTED: "declaration_submitted",
  DECLARATION_REVIEWED: "declaration_reviewed",
  DECLARATION_APPROVED: "declaration_approved",
  DECLARATION_REJECTED: "declaration_rejected",
  DECLARATION_SEALED: "declaration_sealed",

  // Receipts
  RECEIPT_GENERATED: "receipt_generated",
  RECEIPT_DOWNLOADED: "receipt_downloaded",

  // Sensitive read access (compliance: who viewed/exported applicant PII)
  APPLICANT_PII_VIEWED: "applicant_pii_viewed",
  DECLARATION_EXPORTED: "declaration_exported",
  AUDIT_LOG_VIEWED: "audit_log_viewed",
  FILE_DOWNLOADED: "file_downloaded",

  // Section Review
  SECTION_REVIEW_SUBMITTED: "section_review_submitted",
  SECTION_REVIEW_RESOLVED: "section_review_resolved",

  // Admin
  USER_ROLE_CHANGED: "user_role_changed",
  USER_DEACTIVATED: "user_deactivated",
  USER_REACTIVATED: "user_reactivated",
  INSTITUTION_CREATED: "institution_created",
  INSTITUTION_UPDATED: "institution_updated",

  // Categories
  CATEGORY_CREATED: "category_created",
  CATEGORY_UPDATED: "category_updated",
  CATEGORY_DEACTIVATED: "category_deactivated",

  // Code Verification (Legal Unit lookups). Values normalized to snake_case
  // to match the rest of the registry; historic rows hold the old uppercase
  // strings but still match the admin viewer's case-insensitive filter.
  CODE_VERIFIED: "code_verified",
  CODE_VERIFICATION_FAILED: "code_verification_failed",

  // Applicant Verification
  APPLICANT_VERIFICATION_REQUESTED: "applicant_verification_requested",
  APPLICANT_VERIFICATION_REVIEWED: "applicant_verification_reviewed",
  APPLICANT_VERIFICATION_VERIFIED: "applicant_verification_verified",
  APPLICANT_VERIFICATION_ON_HOLD: "applicant_verification_on_hold",
  APPLICANT_VERIFICATION_MORE_INFO: "applicant_verification_more_info",
  APPLICANT_VERIFICATION_REJECTED: "applicant_verification_rejected",
  APPLICANT_VERIFICATION_RESUBMITTED: "applicant_verification_resubmitted",

  // Lost form reissue
  FORM_REISSUE_REQUESTED: "form_reissue_requested",
  FORM_REISSUE_APPROVED: "form_reissue_approved",
  FORM_REISSUE_DECLINED: "form_reissue_declined",

  // Notifications
  NOTIFICATION_PREFERENCES_UPDATED: "notification_preferences_updated",
  NOTIFICATION_TEST_SENT: "notification_test_sent",
  NOTIFICATION_DELIVERY_RETRIED: "notification_delivery_retried",
  SMS_DELIVERY_UPDATED: "sms_delivery_updated",
  NOTIFICATION_CREDENTIAL_UPDATED: "notification_credential_updated",
  NOTIFICATION_CREDENTIAL_CLEARED: "notification_credential_cleared",

  // Public forms
  CONTACT_SUBMITTED: "contact_submitted",

  // Global system settings (Admin → Settings)
  SYSTEM_SETTING_UPDATED: "system_setting_updated",
  SYSTEM_SETTING_CLEARED: "system_setting_cleared",

  // Web analytics, abuse detection & rate limiting
  ABUSE_DETECTED: "abuse_detected",
  ABUSE_THROTTLE_APPLIED: "abuse_throttle_applied",
  ABUSE_BLOCK_APPLIED: "abuse_block_applied",
  RATE_LIMIT_EXCEEDED: "rate_limit_exceeded",
  AI_AGENT_BLOCKED: "ai_agent_blocked",
  AI_AGENT_SPOOFED: "ai_agent_spoofed",
  AI_ROBOTS_VIOLATION: "ai_robots_violation",
  FUZZING_DETECTED: "fuzzing_detected",
  ACTOR_MANUALLY_BLOCKED: "actor_manually_blocked",
  ACTOR_MANUALLY_UNBLOCKED: "actor_manually_unblocked",
  ACTOR_MANUALLY_ALLOWED: "actor_manually_allowed",
} as const;

export type AuditAction = typeof AuditActions[keyof typeof AuditActions];

/**
 * Log an action (simplified interface).
 *
 * Detaches from the response path via `logAudit`. Returns a resolved promise so
 * the ~50 existing `await logAction(...)` call sites keep working unchanged and
 * return immediately (the enqueue/write happens in the background). Not declared
 * `async` — it does no awaiting — so it sidesteps the `require-await` lint while
 * staying a thenable for those callers.
 */
export function logAction(params: {
  userId: string | null | undefined;
  action: string;
  entityType: string | null | undefined;
  entityId: string | null | undefined;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  event: H3Event;
}): Promise<void> {
  logAudit(params.event, {
    userId: params.userId || undefined,
    action: params.action,
    entityType: params.entityType || undefined,
    entityId: params.entityId || undefined,
    oldValues: params.oldValues,
    newValues: params.newValues,
  });
  return Promise.resolve();
}
