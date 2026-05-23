/**
 * Admin "send test notification" endpoint.
 *
 * Lets staff (admin) verify that a notification type renders and
 * delivers correctly across channels without manually driving a
 * declaration through the state machine. Records an audit log so we
 * know who triggered it.
 *
 * POST body:
 *   { targetUserId?: string, type: NotificationType, channels?: NotificationChannel[] }
 *
 * Defaults to sending to the calling admin. The notification goes
 * through the regular sendNotification pipeline, so preferences,
 * dedupe, rate-limiting, and the queue all apply — meaning the
 * preview is representative of real production behaviour.
 */
import { z } from "zod";
import type { NotificationType, NotificationChannel } from "@prisma/client";
import prisma from "~/server/utils/prisma";
import { validateBody } from "~/server/utils/validators";
import { logAction, AuditActions } from "~/server/utils/audit";
import { sendNotification } from "~/server/services/notification.service";
import { payloads } from "~/server/notifications/payloads";

const NOTIFICATION_TYPES: [NotificationType, ...NotificationType[]] = [
  "UNIQUE_CODE_GENERATED",
  "FORM_COLLECTED",
  "FORM_RETURNED",
  "FORM_REISSUE_REQUESTED",
  "FORM_REISSUE_APPROVED",
  "FORM_REISSUE_DECLINED",
  "SECTION_REVIEW_COMMENTS",
  "REVIEW_APPROVED",
  "REVIEW_REJECTED",
  "RECEIPT_READY",
  "PASSWORD_RESET",
  "EMAIL_VERIFICATION",
  "VERIFICATION_SUBMITTED",
  "VERIFICATION_APPROVED",
  "VERIFICATION_REJECTED",
  "VERIFICATION_ON_HOLD",
  "VERIFICATION_MORE_INFO_REQUIRED",
];

const testNotificationSchema = z.object({
  targetUserId: z.string().uuid().optional(),
  type: z.enum(NOTIFICATION_TYPES),
  channels: z.array(z.enum(["EMAIL", "SMS", "IN_APP"])).optional(),
});

const SAMPLE_CODE = "ADLA-TEST-PREVIEW";
const SAMPLE_RECEIPT = "R-TEST-0001";

/**
 * Build a sample payload for each notification type using a fake
 * declaration code / receipt / reason. Mirrors the shapes the real
 * triggers produce so the test send goes through exactly the same
 * template rendering and metadata as production.
 */
function buildSamplePayload(type: NotificationType, name: string): {
  title: string;
  message: string;
  metadata: Record<string, unknown>;
} {
  switch (type) {
    case "UNIQUE_CODE_GENERATED":
      return payloads.uniqueCodeGenerated({ uniqueCode: SAMPLE_CODE, name });
    case "FORM_COLLECTED":
      return payloads.formCollected({
        uniqueCode: SAMPLE_CODE,
        collectionOffice: "Test Office",
        declarationId: "test-declaration",
      });
    case "FORM_RETURNED":
      return payloads.declarationSubmitted({ uniqueCode: SAMPLE_CODE, name });
    case "SECTION_REVIEW_COMMENTS":
      return payloads.sectionReviewComments({
        uniqueCode: SAMPLE_CODE,
        declarationId: "test-declaration",
        issueCount: 2,
      });
    case "REVIEW_APPROVED":
      return payloads.declarationApproved({ uniqueCode: SAMPLE_CODE, name });
    case "REVIEW_REJECTED":
      return payloads.declarationRejected({
        uniqueCode: SAMPLE_CODE,
        name,
        reason: "Sample rejection reason (preview)",
      });
    case "FORM_REISSUE_REQUESTED":
      return payloads.formReissueRequested({ uniqueCode: SAMPLE_CODE, name });
    case "FORM_REISSUE_APPROVED":
      return payloads.formReissueApproved({ uniqueCode: SAMPLE_CODE, name });
    case "FORM_REISSUE_DECLINED":
      return payloads.formReissueDeclined({
        uniqueCode: SAMPLE_CODE,
        name,
        reason: "Sample decline reason (preview)",
      });
    case "RECEIPT_READY":
      return payloads.receiptReady({
        uniqueCode: SAMPLE_CODE,
        receiptNumber: SAMPLE_RECEIPT,
        name,
      });
    case "VERIFICATION_SUBMITTED":
      return payloads.verificationSubmitted({ name });
    case "VERIFICATION_APPROVED":
      return payloads.verificationStatus({
        status: "VERIFIED",
        name,
        reason: "",
        dashboardUrl: "/applicant/dashboard",
      });
    case "VERIFICATION_REJECTED":
      return payloads.verificationStatus({
        status: "REJECTED",
        name,
        reason: "Sample rejection reason (preview)",
        dashboardUrl: "/applicant/dashboard",
      });
    case "VERIFICATION_ON_HOLD":
      return payloads.verificationStatus({
        status: "ON_HOLD",
        name,
        reason: "Sample hold reason (preview)",
        dashboardUrl: "/applicant/dashboard",
      });
    case "VERIFICATION_MORE_INFO_REQUIRED":
      return payloads.verificationStatus({
        status: "MORE_INFO_REQUIRED",
        name,
        reason: "More info needed",
        messageToApplicant: "Sample message to applicant (preview)",
        dashboardUrl: "/applicant/dashboard",
      });
    case "PASSWORD_RESET":
      return {
        title: "Password Reset Request",
        message: "Click the link in your email to reset your password (preview).",
        metadata: { name, resetUrl: "https://example.invalid/reset" },
      };
    case "EMAIL_VERIFICATION":
      return {
        title: "Verify Your Email",
        message: "Click the link in your email to verify your address (preview).",
        metadata: { name, verificationUrl: "https://example.invalid/verify" },
      };
  }
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) throw createError({ statusCode: 401, statusMessage: "Unauthorized" });

  const body = await validateBody(event, testNotificationSchema);
  const targetUserId = body.targetUserId ?? auth.userId;

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: { applicantProfile: true },
  });
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: "Target user not found" });
  }

  const name = target.applicantProfile?.fullName || target.email;
  const sample = buildSamplePayload(body.type, name);

  // Unique dedupe key per test send so the dedupe window doesn't
  // swallow repeated previews of the same type.
  const dedupeKey = `TEST:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

  await sendNotification({
    userId: targetUserId,
    type: body.type,
    title: `[TEST] ${sample.title}`,
    message: `${sample.message} (Preview triggered by admin.)`,
    metadata: { ...sample.metadata, preview: true, triggeredBy: auth.userId },
    channels: body.channels as NotificationChannel[] | undefined,
    dedupeKey,
  });

  await logAction({
    userId: auth.userId,
    action: AuditActions.NOTIFICATION_TEST_SENT,
    entityType: "notification",
    entityId: targetUserId,
    newValues: { type: body.type, channels: body.channels ?? "all" },
    event,
  });

  return {
    success: true,
    message: `Test notification (${body.type}) sent to ${target.email}`,
  };
});
