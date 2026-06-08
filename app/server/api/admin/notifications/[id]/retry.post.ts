import prisma from "~/server/utils/prisma";
import { retryDelivery } from "~/server/services/notification.service";
import { createAuditLog, AuditActions } from "~/server/utils/audit";

/**
 * Admin action: retry a single FAILED delivery. `[id]` is the
 * NotificationDeliveryLog id. Re-enqueues (or sends inline) via retryDelivery,
 * then records an audit log. retryDelivery throws 404/400 for invalid targets.
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
  if (!userRoles.some((ur) => ur.role.name === "admin")) {
    throw createError({ statusCode: 403, statusMessage: "Access denied. Admin role required." });
  }

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Missing delivery log id" });
  }

  const result = await retryDelivery(id);

  await createAuditLog(event, {
    userId: auth.userId,
    action: AuditActions.NOTIFICATION_DELIVERY_RETRIED,
    entityType: "notification_delivery_log",
    entityId: id,
    newValues: { channel: result.channel, status: result.status, queued: result.queued },
  });

  return { success: true, data: result };
});
