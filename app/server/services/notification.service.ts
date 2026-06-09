import { Prisma } from "@prisma/client";
import prisma from "~/server/utils/prisma";
import { sendEmail, type EmailTemplate } from "./email.service";
import { sendSms } from "./sms.service";
import {
  enqueueEmailJob,
  enqueueSmsJob,
  reenqueueEmailJob,
  reenqueueSmsJob,
  processEmailJob,
  processSmsJob,
  isQueueEnabled,
  type EmailJobData,
  type SmsJobData,
} from "~/server/utils/notification-queue";
import { payloads } from "~/server/notifications/payloads";
import { checkRateLimit } from "~/server/utils/rate-limit";
import { getSetting } from "~/server/utils/system-settings";
import { getAnalyticsStorage } from "~/server/utils/analytics-storage";
import { publishToUser } from "~/server/utils/notification-stream";
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
 * Per-user-per-type ceiling. Default is generous (10 of the same type
 * per hour) — meant as a runaway-bug fuse, not a feature limit.
 * Security/transactional types (password reset, email verification)
 * are exempt: see ALWAYS_SEND.
 */
const NOTIFICATION_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
// Resolved via the system-settings registry: env NOTIFICATIONS_RATE_LIMIT_PER_HOUR
// is the fallback, overridable at runtime from Admin → Settings.
function getNotificationRateLimitPerHour(): Promise<number> {
  return getSetting<number>("notifications.rateLimitPerHour");
}

/**
 * Types that bypass dedupe and rate-limiting. Anything users can't
 * disable in their preferences (security/transactional) should go here.
 */
const ALWAYS_SEND: ReadonlySet<NotificationType> = new Set<NotificationType>([
  "PASSWORD_RESET",
  "EMAIL_VERIFICATION",
]);

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
  const bypass = ALWAYS_SEND.has(payload.type);

  if (!bypass && payload.dedupeKey) {
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

  if (!bypass) {
    const rl = await checkRateLimit(getAnalyticsStorage(), {
      key: `notif:${payload.userId}:${payload.type}`,
      limit: await getNotificationRateLimitPerHour(),
      windowMs: NOTIFICATION_RATE_LIMIT_WINDOW_MS,
    });
    if (!rl.allowed) {
      console.warn("[notification.service] per-user-per-type rate limit hit, skipping", {
        userId: payload.userId,
        type: payload.type,
        retryAfterMs: rl.retryAfterMs,
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

  // Create in-app notification if enabled, and publish to any open
  // SSE streams so the bell badge updates without a page reload.
  if (
    channels.includes("IN_APP") &&
    (prefs?.inAppEnabled ?? true) &&
    (typePref?.inAppEnabled ?? true)
  ) {
    const created = await prisma.notification.create({
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
    await publishToUser(payload.userId, {
      type: "notification.created",
      notificationId: created.id,
      title: created.title,
      message: created.message,
      notificationType: created.type,
      createdAt: created.createdAt.toISOString(),
      metadata: (payload.metadata ?? undefined),
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
 * Record an already-sent phone-verification SMS in the notification log.
 *
 * The OTP send itself stays in `send-phone-code.post.ts` as a DIRECT,
 * synchronous `sendSms()` call (so that endpoint can return 502 on failure and
 * the code always goes out regardless of the user's SMS preference). This
 * helper just mirrors the result into a Notification + NotificationDeliveryLog
 * row so it shows up alongside every other SMS in the admin Notification log.
 *
 * It deliberately does NOT receive the code, so the OTP can never be persisted
 * or surfaced to an admin. Best-effort: it never throws — bookkeeping must not
 * break the verification response.
 */
export async function recordPhoneVerificationSms(
  userId: string,
  result: { success: boolean; messageId?: string; error?: string; provider?: string },
): Promise<void> {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type: "PHONE_VERIFICATION_CODE",
        channel: "SMS",
        title: "Phone verification code",
        // Redacted on purpose — the OTP is never passed in or stored.
        message: "A phone verification code was sent by SMS.",
      },
    });

    await prisma.notificationDeliveryLog.create({
      data: {
        notificationId: notification.id,
        channel: "SMS",
        status: result.success ? "DELIVERED" : "FAILED",
        sentAt: new Date(),
        deliveredAt: result.success ? new Date() : null,
        providerResponse: result.success
          ? { messageId: result.messageId, provider: result.provider }
          : { error: result.error },
      },
    });
  } catch (error) {
    console.error("[notification.service] recordPhoneVerificationSms failed", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Record an already-sent staff-invite email in the notification log.
 *
 * The invite itself is sent DIRECTLY (sendStaffInviteEmail) from the admin
 * create-user / resend-invite endpoints — NOT through sendNotification() —
 * because it carries a one-time activation token that must never be
 * persisted (the same reason password-reset / email-verification mails
 * bypass the pipeline). This helper mirrors the send outcome into a redacted
 * Notification + NotificationDeliveryLog so the invite shows up in the admin
 * Notification log with a real DELIVERED/FAILED status — a failed SMTP send
 * is no longer silent.
 *
 * It deliberately does NOT receive the token or invite URL, so neither is
 * ever stored. Best-effort: it never throws — bookkeeping must not break the
 * create-user response.
 */
export async function recordStaffInviteEmail(
  userId: string,
  result: { success: boolean; error?: string },
): Promise<void> {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type: "STAFF_INVITE",
        channel: "EMAIL",
        title: "Staff account invitation",
        // Redacted on purpose — the activation token/link is never stored.
        message: "An account activation invitation was sent by email.",
      },
    });

    await prisma.notificationDeliveryLog.create({
      data: {
        notificationId: notification.id,
        channel: "EMAIL",
        status: result.success ? "DELIVERED" : "FAILED",
        sentAt: new Date(),
        deliveredAt: result.success ? new Date() : null,
        providerResponse: result.success
          ? undefined
          : { error: result.error ?? "send returned false" },
      },
    });
  } catch (error) {
    console.error("[notification.service] recordStaffInviteEmail failed", {
      userId,
      error: error instanceof Error ? error.message : String(error),
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
    // SMS-only type — never emailed (recorded via recordPhoneVerificationSms);
    // present solely to satisfy the exhaustive Record.
    PHONE_VERIFICATION_CODE: "welcome",
    STAFF_INVITE: "staff-invite",
  };
  return mapping[type] || "welcome";
}

export interface RetryResult {
  deliveryLogId: string;
  channel: NotificationChannel;
  status: "PENDING" | "DELIVERED" | "FAILED";
  /** true when re-enqueued (worker will update the log later); false when sent inline. */
  queued: boolean;
}

/**
 * Admin action: retry a single FAILED delivery log.
 *
 * Rebuilds the provider payload faithfully from the stored Notification + User
 * (identical to the original dispatch in sendNotificationInternal), then
 * re-enqueues it — or sends inline when the queue is disabled. It does NOT go
 * through sendNotification(), so it skips dedupe/rate-limit and never creates
 * duplicate Notification rows; it reuses the existing delivery log. IN_APP has
 * no provider send and cannot be retried.
 *
 * Throws createError (404/400) on invalid input; the caller writes the audit log.
 */
export async function retryDelivery(deliveryLogId: string): Promise<RetryResult> {
  const log = await prisma.notificationDeliveryLog.findUnique({
    where: { id: deliveryLogId },
    include: {
      notification: { include: { user: { include: { applicantProfile: true } } } },
    },
  });

  if (!log) {
    throw createError({ statusCode: 404, statusMessage: "Delivery log not found" });
  }
  if (log.status !== "FAILED") {
    throw createError({ statusCode: 400, statusMessage: "Only FAILED deliveries can be retried" });
  }
  if (log.channel === "IN_APP") {
    throw createError({ statusCode: 400, statusMessage: "IN_APP notifications cannot be retried" });
  }

  const { notification } = log;

  // Phone verification codes are single-use and time-boxed, and the stored
  // message is redacted (never holds the OTP). Re-sending it would deliver a
  // code-less, useless SMS — the applicant must request a fresh code instead.
  if (notification.type === "PHONE_VERIFICATION_CODE") {
    throw createError({
      statusCode: 400,
      statusMessage: "Phone verification codes cannot be retried — ask the applicant to request a new code",
    });
  }

  // Staff invites carry a one-time activation token that is deliberately not
  // stored on the notification, so a retry here would email a broken link.
  // Use "Resend invitation" on the user, which mints a fresh 72h token.
  if (notification.type === "STAFF_INVITE") {
    throw createError({
      statusCode: 400,
      statusMessage: "Staff invitations cannot be retried here — use \"Resend invitation\", which issues a fresh activation link",
    });
  }

  const user = notification.user;
  const metadata = (notification.metadata ?? {}) as Record<string, unknown>;

  // Reset to in-flight so the UI reflects the retry immediately.
  await prisma.notificationDeliveryLog.update({
    where: { id: log.id },
    data: { status: "PENDING", providerResponse: Prisma.JsonNull },
  });

  const attemptsMade = log.retryCount + 1;

  if (log.channel === "EMAIL") {
    if (!user.email) {
      throw createError({ statusCode: 400, statusMessage: "Recipient has no email address" });
    }
    const jobData: EmailJobData = {
      deliveryLogId: log.id,
      to: user.email,
      subject: notification.title,
      template: mapNotificationTypeToEmailTemplate(notification.type),
      data: { name: user.applicantProfile?.fullName || user.email, ...metadata },
    };
    if (isQueueEnabled()) {
      await reenqueueEmailJob(jobData);
      return { deliveryLogId: log.id, channel: "EMAIL", status: "PENDING", queued: true };
    }
    await runInlineRetry(() =>
      processEmailJob({ data: jobData, attemptsMade } as Parameters<typeof processEmailJob>[0]),
    );
  } else {
    if (!user.phone) {
      throw createError({ statusCode: 400, statusMessage: "Recipient has no phone number" });
    }
    const jobData: SmsJobData = { deliveryLogId: log.id, to: user.phone, message: notification.message };
    if (isQueueEnabled()) {
      await reenqueueSmsJob(jobData);
      return { deliveryLogId: log.id, channel: "SMS", status: "PENDING", queued: true };
    }
    await runInlineRetry(() =>
      processSmsJob({ data: jobData, attemptsMade } as Parameters<typeof processSmsJob>[0]),
    );
  }

  // Inline path: process*Job already updated the log (and threw on failure).
  const updated = await prisma.notificationDeliveryLog.findUnique({
    where: { id: log.id },
    select: { status: true },
  });
  return {
    deliveryLogId: log.id,
    channel: log.channel,
    status: (updated?.status ?? "FAILED") as "DELIVERED" | "FAILED",
    queued: false,
  };
}

/**
 * process*Job throws on send failure (so BullMQ would retry). For an inline
 * admin retry we don't want that surfaced as a 500 — the delivery log already
 * records the DELIVERED/FAILED outcome, which the caller reads back.
 */
async function runInlineRetry(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch {
    /* outcome captured on the delivery log */
  }
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
 * Send notification that verification was submitted.
 *
 * `dedupeKey` should be a per-submission identifier (e.g. `profile.id`
 * for initial submit, or `${profile.id}:${updatedAt}` for resubmits) so
 * double-clicks dedupe but legitimate re-submissions don't.
 */
export async function notifyVerificationSubmitted(
  userId: string,
  name: string,
  dedupeKey?: string,
): Promise<void> {
  await sendNotification({
    userId,
    type: "VERIFICATION_SUBMITTED",
    ...payloads.verificationSubmitted({ name }),
    channels: ["EMAIL", "IN_APP"],
    dedupeKey,
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
