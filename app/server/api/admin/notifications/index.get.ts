import prisma from "~/server/utils/prisma";
import type { Prisma, DeliveryStatus, NotificationChannel, NotificationType } from "@prisma/client";

const STATUSES = new Set<DeliveryStatus>(["PENDING", "SENT", "DELIVERED", "FAILED"]);
const CHANNELS = new Set<NotificationChannel>(["EMAIL", "SMS", "IN_APP"]);
const TYPES = new Set<NotificationType>([
  "UNIQUE_CODE_GENERATED", "FORM_COLLECTED", "FORM_RETURNED", "FORM_REISSUE_REQUESTED",
  "FORM_REISSUE_APPROVED", "FORM_REISSUE_DECLINED", "SECTION_REVIEW_COMMENTS", "REVIEW_APPROVED",
  "REVIEW_REJECTED", "RECEIPT_READY", "PASSWORD_RESET", "EMAIL_VERIFICATION",
  "VERIFICATION_SUBMITTED", "VERIFICATION_APPROVED", "VERIFICATION_REJECTED",
  "VERIFICATION_ON_HOLD", "VERIFICATION_MORE_INFO_REQUIRED",
]);

/**
 * Admin notification monitoring — the delivery log.
 *
 * One row per NotificationDeliveryLog (per-channel send), joined to its
 * Notification + recipient User. Mirrors the audit-logs list endpoint:
 * inline admin re-check, limit/offset, where-builder, [rows,total] count,
 * `{ success, data: { items, total, limit, offset } }` envelope.
 */
export default defineEventHandler(async (event) => {
  const auth = event.context.auth;

  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const userRoles = await prisma.userRole.findMany({
    where: { userId: auth.userId },
    include: { role: true },
  });
  const isAdmin = userRoles.some((ur) => ur.role.name === "admin");
  if (!isAdmin) {
    throw createError({ statusCode: 403, statusMessage: "Access denied. Admin role required." });
  }

  const query = getQuery(event);
  const limit = Math.min(Number(query.limit) || 50, 100);
  const offset = Number(query.offset) || 0;
  const search = query.search as string | undefined;
  const status = query.status as string | undefined;
  const channel = query.channel as string | undefined;
  const type = query.type as string | undefined;
  const dateFrom = query.dateFrom as string | undefined;
  const dateTo = query.dateTo as string | undefined;

  const where: Prisma.NotificationDeliveryLogWhereInput = {};

  if (status && STATUSES.has(status as DeliveryStatus)) {
    where.status = status as DeliveryStatus;
  }
  if (channel && CHANNELS.has(channel as NotificationChannel)) {
    where.channel = channel as NotificationChannel;
  }

  // Filters that live on the parent Notification (type) or recipient (search).
  const notificationWhere: Prisma.NotificationWhereInput = {};
  if (type && TYPES.has(type as NotificationType)) {
    notificationWhere.type = type as NotificationType;
  }
  if (search) {
    notificationWhere.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { user: { email: { contains: search, mode: "insensitive" } } },
      { user: { phone: { contains: search, mode: "insensitive" } } },
    ];
  }
  if (Object.keys(notificationWhere).length > 0) {
    where.notification = notificationWhere;
  }

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(dateFrom);
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      (where.createdAt as Prisma.DateTimeFilter).lte = toDate;
    }
  }

  const [logs, total] = await Promise.all([
    prisma.notificationDeliveryLog.findMany({
      where,
      include: {
        notification: {
          select: {
            id: true,
            type: true,
            title: true,
            createdAt: true,
            user: { select: { email: true, phone: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.notificationDeliveryLog.count({ where }),
  ]);

  return {
    success: true,
    data: {
      items: logs.map((log) => ({
        id: log.id,
        channel: log.channel,
        status: log.status,
        retryCount: log.retryCount,
        createdAt: log.createdAt.toISOString(),
        sentAt: log.sentAt?.toISOString() ?? null,
        deliveredAt: log.deliveredAt?.toISOString() ?? null,
        providerResponse: log.providerResponse,
        notification: {
          id: log.notification.id,
          type: log.notification.type,
          title: log.notification.title,
          recipientEmail: log.notification.user?.email ?? null,
          recipientPhone: log.notification.user?.phone ?? null,
          createdAt: log.notification.createdAt.toISOString(),
        },
      })),
      total,
      limit,
      offset,
    },
  };
});
