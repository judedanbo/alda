import type { H3Event } from "h3";
import { Prisma } from "@prisma/client";
import prisma from "./prisma";
import { extractClientIp } from "./request-meta";
import { scrubAuditValues } from "./pii";

export interface AuditLogData {
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(
  event: H3Event,
  data: AuditLogData
): Promise<void> {
  const ipAddress = extractClientIp(event);
  const userAgent = getHeader(event, "user-agent") || "unknown";
  const sessionId = getCookie(event, "session_id") || undefined;

  // Mask known PII fields (Ghana Card numbers, full names, emails, phones,
  // bucket keys) before persisting. Old rows written before this change
  // still contain plaintext; new rows do not. See server/utils/pii.ts.
  const scrubbedOld = scrubAuditValues(data.oldValues);
  const scrubbedNew = scrubAuditValues(data.newValues);

  try {
    await prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        oldValues: (scrubbedOld ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        newValues: (scrubbedNew ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        ipAddress,
        userAgent,
        sessionId,
      },
    });
  } catch (error) {
    // Log error but don't fail the request
    console.error("Failed to create audit log:", error);
  }
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
  EMAIL_VERIFIED: "email_verified",
  PHONE_CODE_REQUESTED: "phone_code_requested",
  PHONE_VERIFIED: "phone_verified",
  PHONE_VERIFICATION_FAILED: "phone_verification_failed",

  // Profile
  PROFILE_CREATED: "profile_created",
  PROFILE_UPDATED: "profile_updated",

  // Offices
  OFFICE_ADDED: "office_added",
  OFFICE_UPDATED: "office_updated",
  OFFICE_REMOVED: "office_removed",

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

  // Code Verification (Legal Unit lookups)
  CODE_VERIFIED: "CODE_VERIFIED",
  CODE_VERIFICATION_FAILED: "CODE_VERIFICATION_FAILED",

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
  NOTIFICATION_TEST_SENT: "notification_test_sent",

  // Web analytics, abuse detection & rate limiting
  ABUSE_DETECTED: "abuse_detected",
  ABUSE_THROTTLE_APPLIED: "abuse_throttle_applied",
  ABUSE_BLOCK_APPLIED: "abuse_block_applied",
  RATE_LIMIT_EXCEEDED: "rate_limit_exceeded",
  AI_AGENT_BLOCKED: "ai_agent_blocked",
  AI_AGENT_SPOOFED: "ai_agent_spoofed",
  AI_ROBOTS_VIOLATION: "ai_robots_violation",
  ACTOR_MANUALLY_BLOCKED: "actor_manually_blocked",
  ACTOR_MANUALLY_UNBLOCKED: "actor_manually_unblocked",
  ACTOR_MANUALLY_ALLOWED: "actor_manually_allowed",
} as const;

export type AuditAction = typeof AuditActions[keyof typeof AuditActions];

/**
 * Log an action (simplified interface)
 */
export async function logAction(params: {
  userId: string | null | undefined;
  action: string;
  entityType: string | null | undefined;
  entityId: string | null | undefined;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  event: H3Event;
}): Promise<void> {
  await createAuditLog(params.event, {
    userId: params.userId || undefined,
    action: params.action,
    entityType: params.entityType || undefined,
    entityId: params.entityId || undefined,
    oldValues: params.oldValues,
    newValues: params.newValues,
  });
}
