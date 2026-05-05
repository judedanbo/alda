import { Prisma } from "@prisma/client";
import prisma from "~/server/utils/prisma";
import { sendEmail, type EmailTemplate } from "./email.service";
import { sendSms } from "./sms.service";
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
}

/**
 * Send notification through specified channels
 */
export async function sendNotification(payload: NotificationPayload): Promise<void> {
  // Get user with their notification preferences
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: {
      notificationPrefs: true,
      applicantProfile: true,
    },
  });

  if (!user) {
    console.error("User not found for notification:", payload.userId);
    return;
  }

  const prefs = user.notificationPrefs;
  const channels = payload.channels || ["EMAIL", "SMS", "IN_APP"] as NotificationChannel[];

  // Create in-app notification if enabled
  if (channels.includes("IN_APP") && (prefs?.inAppEnabled ?? true)) {
    await prisma.notification.create({
      data: {
        userId: payload.userId,
        type: payload.type,
        channel: "IN_APP",
        title: payload.title,
        message: payload.message,
        metadata: (payload.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });
  }

  // Send email if enabled
  if (channels.includes("EMAIL") && (prefs?.emailEnabled ?? true)) {
    const notification = await prisma.notification.create({
      data: {
        userId: payload.userId,
        type: payload.type,
        channel: "EMAIL",
        title: payload.title,
        message: payload.message,
        metadata: (payload.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });

    // Create delivery log and attempt delivery
    const deliveryLog = await prisma.notificationDeliveryLog.create({
      data: {
        notificationId: notification.id,
        channel: "EMAIL",
        status: "PENDING",
      },
    });

    try {
      const success = await sendEmail({
        to: user.email,
        subject: payload.title,
        template: mapNotificationTypeToEmailTemplate(payload.type),
        data: {
          name: user.applicantProfile?.fullName || user.email,
          ...payload.metadata,
        },
      });

      await prisma.notificationDeliveryLog.update({
        where: { id: deliveryLog.id },
        data: {
          status: success ? "DELIVERED" : "FAILED",
          sentAt: new Date(),
          deliveredAt: success ? new Date() : null,
        },
      });
    } catch (error) {
      await prisma.notificationDeliveryLog.update({
        where: { id: deliveryLog.id },
        data: {
          status: "FAILED",
          providerResponse: { error: String(error) },
        },
      });
    }
  }

  // Send SMS if enabled and user has phone
  if (channels.includes("SMS") && (prefs?.smsEnabled ?? true) && user.phone) {
    const notification = await prisma.notification.create({
      data: {
        userId: payload.userId,
        type: payload.type,
        channel: "SMS",
        title: payload.title,
        message: payload.message,
        metadata: (payload.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });

    const deliveryLog = await prisma.notificationDeliveryLog.create({
      data: {
        notificationId: notification.id,
        channel: "SMS",
        status: "PENDING",
      },
    });

    try {
      const result = await sendSms(user.phone, payload.message);

      await prisma.notificationDeliveryLog.update({
        where: { id: deliveryLog.id },
        data: {
          status: result.success ? "DELIVERED" : "FAILED",
          sentAt: new Date(),
          deliveredAt: result.success ? new Date() : null,
          providerResponse: result.success
            ? { messageId: result.messageId }
            : { error: result.error },
        },
      });
    } catch (error) {
      await prisma.notificationDeliveryLog.update({
        where: { id: deliveryLog.id },
        data: {
          status: "FAILED",
          providerResponse: { error: String(error) },
        },
      });
    }
  }
}

/**
 * Map notification type to email template
 */
function mapNotificationTypeToEmailTemplate(type: NotificationType): EmailTemplate {
  const mapping: Record<NotificationType, EmailTemplate> = {
    UNIQUE_CODE_GENERATED: "unique-code",
    SUBMISSION_RECORDED: "declaration-submitted",
    REVIEW_APPROVED: "declaration-approved",
    REVIEW_REJECTED: "declaration-rejected",
    RECEIPT_READY: "receipt-ready",
    PICKUP_REMINDER: "pickup-notification",
    PASSWORD_RESET: "password-reset",
    EMAIL_VERIFICATION: "email-verification",
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
    title: `Your Declaration Code: ${uniqueCode}`,
    message: `Your unique declaration code is ${uniqueCode}. Keep this code safe for tracking your declaration.`,
    metadata: { uniqueCode, name },
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
    type: "SUBMISSION_RECORDED",
    title: "Declaration Submitted",
    message: `Your declaration (${uniqueCode}) has been submitted for review.`,
    metadata: {
      uniqueCode,
      name,
      submittedAt: new Date().toISOString(),
    },
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
    title: "Declaration Approved",
    message: `Congratulations! Your declaration (${uniqueCode}) has been approved.`,
    metadata: {
      uniqueCode,
      name,
      approvedAt: new Date().toISOString(),
    },
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
    title: "Declaration Requires Attention",
    message: `Your declaration (${uniqueCode}) requires attention. Reason: ${reason}`,
    metadata: {
      uniqueCode,
      name,
      rejectionReason: reason,
    },
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
    title: "Receipt Ready",
    message: `Your receipt (${receiptNumber}) for declaration ${uniqueCode} is ready.`,
    metadata: {
      uniqueCode,
      receiptNumber,
      name,
    },
  });
}

/**
 * Send pickup reminder notification
 */
export async function notifyPickupReady(
  userId: string,
  uniqueCode: string,
  receiptNumber: string,
  name: string,
  authorizedPerson?: string,
  authorizedPhone?: string
): Promise<void> {
  await sendNotification({
    userId,
    type: "PICKUP_REMINDER",
    title: "Pickup Notification",
    message: `Your sealed declaration document (${uniqueCode}) is ready for pickup.`,
    metadata: {
      uniqueCode,
      receiptNumber,
      name,
      authorizedPerson,
      authorizedPhone,
    },
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
): Promise<{ notifications: any[]; total: number; unreadCount: number }> {
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
