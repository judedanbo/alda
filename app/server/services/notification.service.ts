import { Prisma } from "@prisma/client";
import prisma from "~/server/utils/prisma";
import { sendEmail, type EmailTemplate } from "./email.service";
import { sendSms } from "./sms.service";
import {
  enqueueEmailJob,
  enqueueSmsJob,
  isQueueEnabled,
} from "~/server/utils/notification-queue";
import { payloads } from "~/server/notifications/payloads";
import type { NotificationType, NotificationChannel } from "@prisma/client";

/**
 * Notification payload
 */
export interface NotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  channels?: NotificationChannel[];
  /**
   * Optional dedupe key. If a notification with the same
   * (userId, type, dedupeKey) was created within DEDUPE_WINDOW_MS, the
   * send is skipped. Use the natural entity id of whatever triggered the
   * notification (declaration code, receipt number, reissue request id).
   */
  dedupeKey?: string;
}

/**
 * Window during which a repeated (userId, type, dedupeKey) is treated as a
 * duplicate and skipped. Short enough to allow legitimate re-sends (e.g.
 * an applicant who later resubmits) but long enough to absorb double
 * clicks and handler retries.
 */
const DEDUPE_WINDOW_MS = 5 * 60 * 1000;

/**
 * Send a notification across the configured channels. This function is
 * intentionally swallow-all: it never throws, so callers do not need to
 * wrap it in try/catch. Notification failures must not break the state
 * transition that triggered them.
 */
export async function sendNotification(payload: NotificationPayload): Promise<void> {
  try {
    await sendNotificationInternal(payload);
  } catch (error) {
    console.error("[notification.service] sendNotification failed", {
      userId: payload.userId,
      type: payload.type,
      dedupeKey: payload.dedupeKey,
      error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
    });
  }
}

async function sendNotificationInternal(payload: NotificationPayload): Promise<void> {
  if (payload.dedupeKey) {
    const cutoff = new Date(Date.now() - DEDUPE_WINDOW_MS);
    const existing = await prisma.notification.findFirst({
      where: {
        userId: payload.userId,
        type: payload.type,
        dedupeKey: payload.dedupeKey,
        createdAt: { gte: cutoff },
      },
      select: { id: true },
    });
    if (existing) {
      console.info("[notification.service] dedupe hit, skipping", {
        userId: payload.userId,
        type: payload.type,
        dedupeKey: payload.dedupeKey,
      });
      return;
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: {
      notificationPrefs: true,
      notificationTypePrefs: { where: { type: payload.type } },
      applicantProfile: true,
    },
  });

  if (!user) {
    console.error("User not found for notification:", payload.userId);
    return;
  }

  const prefs = user.notificationPrefs;
  // Per-type preference for this notification (missing row => all channels on)
  const typePref = user.notificationTypePrefs[0];
  const channels = payload.channels || ["EMAIL", "SMS", "IN_APP"] as NotificationChannel[];

  // Create in-app notification if enabled
  if (
    channels.includes("IN_APP") &&
    (prefs?.inAppEnabled ?? true) &&
    (typePref?.inAppEnabled ?? true)
  ) {
    await prisma.notification.create({
      data: {
        userId: payload.userId,
        type: payload.type,
        channel: "IN_APP",
        title: payload.title,
        message: payload.message,
        metadata: (payload.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        dedupeKey: payload.dedupeKey,
      },
    });
  }

  // Send email if enabled
  if (
    channels.includes("EMAIL") &&
    (prefs?.emailEnabled ?? true) &&
    (typePref?.emailEnabled ?? true)
  ) {
    const notification = await prisma.notification.create({
      data: {
        userId: payload.userId,
        type: payload.type,
        channel: "EMAIL",
        title: payload.title,
        message: payload.message,
        metadata: (payload.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        dedupeKey: payload.dedupeKey,
      },
    });

    // Create delivery log; the queue worker (or inline fallback) will
    // flip its status to DELIVERED/FAILED.
    const deliveryLog = await prisma.notificationDeliveryLog.create({
      data: {
        notificationId: notification.id,
        channel: "EMAIL",
        status: "PENDING",
      },
    });

    const jobData = {
      deliveryLogId: deliveryLog.id,
      to: user.email,
      subject: payload.title,
      template: mapNotificationTypeToEmailTemplate(payload.type),
      data: {
        name: user.applicantProfile?.fullName || user.email,
        ...payload.metadata,
      } as Record<string, unknown>,
    };

    if (isQueueEnabled()) {
      try {
        await enqueueEmailJob(jobData);
      } catch (error) {
        // Queue unreachable — fall back to inline send so the
        // notification still goes out (best-effort).
        console.warn("[notification.service] email enqueue failed, falling back to inline send", error);
        await sendEmailInline(deliveryLog.id, jobData);
      }
    } else {
      await sendEmailInline(deliveryLog.id, jobData);
    }
  }

  // Send SMS if enabled and user has phone
  if (
    channels.includes("SMS") &&
    (prefs?.smsEnabled ?? true) &&
    (typePref?.smsEnabled ?? true) &&
    user.phone
  ) {
    const notification = await prisma.notification.create({
      data: {
        userId: payload.userId,
        type: payload.type,
        channel: "SMS",
        title: payload.title,
        message: payload.message,
        metadata: (payload.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        dedupeKey: payload.dedupeKey,
      },
    });

    const deliveryLog = await prisma.notificationDeliveryLog.create({
      data: {
        notificationId: notification.id,
        channel: "SMS",
        status: "PENDING",
      },
    });

    const jobData = {
      deliveryLogId: deliveryLog.id,
      to: user.phone,
      message: payload.message,
    };

    if (isQueueEnabled()) {
      try {
        await enqueueSmsJob(jobData);
      } catch (error) {
        console.warn("[notification.service] sms enqueue failed, falling back to inline send", error);
        await sendSmsInline(deliveryLog.id, jobData);
      }
    } else {
      await sendSmsInline(deliveryLog.id, jobData);
    }
  }
}

/**
 * Inline email send — used when the queue is disabled or unreachable.
 * Mirrors what the BullMQ worker does, minus the retry mechanism.
 */
async function sendEmailInline(
  deliveryLogId: string,
  data: { to: string; subject: string; template: EmailTemplate; data: Record<string, unknown> },
): Promise<void> {
  try {
    const success = await sendEmail({
      to: data.to,
      subject: data.subject,
      template: data.template,
      data: data.data,
    });
    await prisma.notificationDeliveryLog.update({
      where: { id: deliveryLogId },
      data: {
        status: success ? "DELIVERED" : "FAILED",
        sentAt: new Date(),
        deliveredAt: success ? new Date() : null,
      },
    });
  } catch (error) {
    await prisma.notificationDeliveryLog.update({
      where: { id: deliveryLogId },
      data: {
        status: "FAILED",
        providerResponse: { error: String(error) },
      },
    });
  }
}

async function sendSmsInline(
  deliveryLogId: string,
  data: { to: string; message: string },
): Promise<void> {
  try {
    const result = await sendSms(data.to, data.message);
    await prisma.notificationDeliveryLog.update({
      where: { id: deliveryLogId },
      data: {
        status: result.success ? "DELIVERED" : "FAILED",
        sentAt: new Date(),
        deliveredAt: result.success ? new Date() : null,
        providerResponse: result.success
          ? { messageId: result.messageId, provider: result.provider }
          : { error: result.error },
      },
    });
  } catch (error) {
    await prisma.notificationDeliveryLog.update({
      where: { id: deliveryLogId },
      data: {
        status: "FAILED",
        providerResponse: { error: String(error) },
      },
    });
  }
}

/**
 * Map notification type to email template
 */
function mapNotificationTypeToEmailTemplate(type: NotificationType): EmailTemplate {
  const mapping: Record<NotificationType, EmailTemplate> = {
    UNIQUE_CODE_GENERATED: "unique-code",
    FORM_COLLECTED: "declaration-submitted",
    FORM_RETURNED: "declaration-submitted",
    FORM_REISSUE_REQUESTED: "declaration-submitted",
    FORM_REISSUE_APPROVED: "declaration-submitted",
    FORM_REISSUE_DECLINED: "declaration-rejected",
    SECTION_REVIEW_COMMENTS: "declaration-submitted",
    REVIEW_APPROVED: "declaration-approved",
    REVIEW_REJECTED: "declaration-rejected",
    RECEIPT_READY: "receipt-ready",
    PASSWORD_RESET: "password-reset",
    EMAIL_VERIFICATION: "email-verification",
    VERIFICATION_SUBMITTED: "verification-submitted",
    VERIFICATION_APPROVED: "verification-approved",
    VERIFICATION_REJECTED: "verification-rejected",
    VERIFICATION_ON_HOLD: "verification-on-hold",
    VERIFICATION_MORE_INFO_REQUIRED: "verification-more-info",
  };
  return mapping[type] || "welcome";
}

/**
 * Send unique code notification
 */
export async function notifyUniqueCodeGenerated(
  userId: string,
  uniqueCode: string,
  name: string
): Promise<void> {
  await sendNotification({
    userId,
    type: "UNIQUE_CODE_GENERATED",
    ...payloads.uniqueCodeGenerated({ uniqueCode, name }),
    dedupeKey: uniqueCode,
  });
}

/**
 * Send declaration submitted notification
 */
export async function notifyDeclarationSubmitted(
  userId: string,
  uniqueCode: string,
  name: string
): Promise<void> {
  await sendNotification({
    userId,
    type: "FORM_RETURNED",
    ...payloads.declarationSubmitted({ uniqueCode, name }),
    dedupeKey: uniqueCode,
  });
}

/**
 * Send declaration approved notification
 */
export async function notifyDeclarationApproved(
  userId: string,
  uniqueCode: string,
  name: string
): Promise<void> {
  await sendNotification({
    userId,
    type: "REVIEW_APPROVED",
    ...payloads.declarationApproved({ uniqueCode, name }),
    dedupeKey: uniqueCode,
  });
}

/**
 * Send declaration rejected notification
 */
export async function notifyDeclarationRejected(
  userId: string,
  uniqueCode: string,
  name: string,
  reason: string
): Promise<void> {
  await sendNotification({
    userId,
    type: "REVIEW_REJECTED",
    ...payloads.declarationRejected({ uniqueCode, name, reason }),
    dedupeKey: uniqueCode,
  });
}

/**
 * Send lost-form reissue request confirmation (to the applicant)
 */
export async function notifyFormReissueRequested(
  userId: string,
  uniqueCode: string,
  name: string,
  reissueRequestId?: string,
): Promise<void> {
  await sendNotification({
    userId,
    type: "FORM_REISSUE_REQUESTED",
    ...payloads.formReissueRequested({ uniqueCode, name }),
    channels: ["IN_APP"],
    dedupeKey: reissueRequestId ?? uniqueCode,
  });
}

/**
 * Send lost-form reissue approved notification (to the applicant)
 */
export async function notifyFormReissueApproved(
  userId: string,
  uniqueCode: string,
  name: string,
  reissueRequestId?: string,
): Promise<void> {
  await sendNotification({
    userId,
    type: "FORM_REISSUE_APPROVED",
    ...payloads.formReissueApproved({ uniqueCode, name }),
    dedupeKey: reissueRequestId ?? uniqueCode,
  });
}

/**
 * Send lost-form reissue declined notification (to the applicant)
 */
export async function notifyFormReissueDeclined(
  userId: string,
  uniqueCode: string,
  name: string,
  reason: string,
  reissueRequestId?: string,
): Promise<void> {
  await sendNotification({
    userId,
    type: "FORM_REISSUE_DECLINED",
    ...payloads.formReissueDeclined({ uniqueCode, name, reason }),
    channels: ["EMAIL", "IN_APP"],
    dedupeKey: reissueRequestId ?? uniqueCode,
  });
}

/**
 * Send receipt ready notification
 */
export async function notifyReceiptReady(
  userId: string,
  uniqueCode: string,
  receiptNumber: string,
  name: string
): Promise<void> {
  await sendNotification({
    userId,
    type: "RECEIPT_READY",
    ...payloads.receiptReady({ uniqueCode, receiptNumber, name }),
    dedupeKey: receiptNumber,
  });
}

/**
 * Send verification status change notification
 */
export async function notifyVerificationStatusChanged(
  userId: string,
  status: "VERIFIED" | "ON_HOLD" | "MORE_INFO_REQUIRED" | "REJECTED",
  name: string,
  reason: string,
  messageToApplicant?: string,
): Promise<void> {
  const config = useRuntimeConfig();
  const dashboardUrl = `${config.public.appUrl}/applicant/dashboard`;

  const typeMap: Record<string, NotificationType> = {
    VERIFIED: "VERIFICATION_APPROVED",
    ON_HOLD: "VERIFICATION_ON_HOLD",
    MORE_INFO_REQUIRED: "VERIFICATION_MORE_INFO_REQUIRED",
    REJECTED: "VERIFICATION_REJECTED",
  };

  const channelMap: Record<string, NotificationChannel[]> = {
    VERIFIED: ["EMAIL", "SMS", "IN_APP"],
    ON_HOLD: ["EMAIL", "IN_APP"],
    MORE_INFO_REQUIRED: ["EMAIL", "SMS", "IN_APP"],
    REJECTED: ["EMAIL", "IN_APP"],
  };

  await sendNotification({
    userId,
    type: typeMap[status]!,
    ...payloads.verificationStatus({ status, name, reason, messageToApplicant, dashboardUrl }),
    channels: channelMap[status],
    dedupeKey: `${status}:${userId}`,
  });
}

/**
 * Send notification that verification was submitted
 */
export async function notifyVerificationSubmitted(
  userId: string,
  name: string,
): Promise<void> {
  await sendNotification({
    userId,
    type: "VERIFICATION_SUBMITTED",
    ...payloads.verificationSubmitted({ name }),
    channels: ["EMAIL", "IN_APP"],
  });
}

/**
 * Get unread notification count for user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: {
      userId,
      channel: "IN_APP",
      readAt: null,
    },
  });
}

/**
 * Get notifications for user
 */
export async function getUserNotifications(
  userId: string,
  options: { limit?: number; offset?: number; unreadOnly?: boolean } = {}
): Promise<{ notifications: Prisma.NotificationGetPayload<object>[]; total: number; unreadCount: number }> {
  const { limit = 20, offset = 0, unreadOnly = false } = options;

  const where = {
    userId,
    channel: "IN_APP" as NotificationChannel,
    ...(unreadOnly ? { readAt: null } : {}),
  };

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({
      where: { userId, channel: "IN_APP", readAt: null },
    }),
  ]);

  return { notifications, total, unreadCount };
}

/**
 * Mark notification as read
 */
export async function markAsRead(notificationId: string, userId: string): Promise<boolean> {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  });

  if (!notification) return false;

  await prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
  });

  return true;
}

/**
 * Mark all notifications as read
 */
export async function markAllAsRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId, channel: "IN_APP", readAt: null },
    data: { readAt: new Date() },
  });

  return result.count;
}
