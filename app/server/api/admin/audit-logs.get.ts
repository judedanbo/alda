import prisma from "~/server/utils/prisma";
import { logAudit, AuditActions } from "~/server/utils/audit";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;

  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  const userRoles = await prisma.userRole.findMany({
    where: { userId: auth.userId },
    include: { role: true },
  });

  const isAdmin = userRoles.some((ur) => ur.role.name === "admin");

  if (!isAdmin) {
    throw createError({
      statusCode: 403,
      statusMessage: "Access denied. Admin role required.",
    });
  }

  const query = getQuery(event);
  const limit = Math.min(Number(query.limit) || 50, 100);
  const offset = Number(query.offset) || 0;
  const search = query.search as string | undefined;
  const action = query.action as string | undefined;
  const entityType = query.entityType as string | undefined;
  const dateFrom = query.dateFrom as string | undefined;
  const dateTo = query.dateTo as string | undefined;

  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { user: { email: { contains: search, mode: "insensitive" } } },
      { ipAddress: { contains: search, mode: "insensitive" } },
    ];
  }

  if (action) {
    where.action = { contains: action, mode: "insensitive" };
  }

  if (entityType) {
    where.entityType = entityType;
  }

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) {
      (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      (where.createdAt as Record<string, unknown>).lte = toDate;
    }
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.auditLog.count({ where }),
  ]);

  // Compliance: the audit trail itself is sensitive — record each admin query
  // against it (the "who watches the watchers" log), capturing only the filter
  // params and result count, never row contents.
  logAudit(event, {
    userId: auth.userId,
    action: AuditActions.AUDIT_LOG_VIEWED,
    entityType: "audit_log",
    newValues: { search, action, entityType, dateFrom, dateTo, resultCount: total, limit, offset },
  });

  return {
    success: true,
    data: {
      logs: logs.map((log) => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        oldValues: log.oldValues,
        newValues: log.newValues,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt.toISOString(),
        user: log.user,
      })),
      total,
      limit,
      offset,
    },
  };
});
