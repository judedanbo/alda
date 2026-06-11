import prisma from "~/server/utils/prisma";
import { logAudit, AuditActions } from "~/server/utils/audit";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const callerRoles = await prisma.userRole.findMany({
    where: { userId: auth.userId },
    include: { role: true },
  });
  if (!callerRoles.some((ur) => ur.role.name === "admin")) {
    throw createError({
      statusCode: 403,
      statusMessage: "Access denied. Admin role required.",
    });
  }

  const userId = getRouterParam(event, "id");
  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: "User ID is required" });
  }

  // Self-delete guard.
  if (userId === auth.userId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "You cannot delete your own account",
    });
  }

  const target = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      email: true,
      roles: { include: { role: true } },
    },
  });
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: "User not found" });
  }

  // Last-admin guard: never leave the system without an active admin.
  const targetIsAdmin = target.roles.some((r) => r.role.name === "admin");
  if (targetIsAdmin) {
    const otherActiveAdmins = await prisma.user.count({
      where: {
        id: { not: userId },
        isActive: true,
        deletedAt: null,
        roles: { some: { role: { name: "admin" } } },
      },
    });
    if (otherActiveAdmins === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: "Bad Request",
        message: "Cannot delete the last active administrator",
      });
    }
  }

  // Soft delete — retain the row (audit logs, receipts, declaration history all
  // FK to users and audit retention is a compliance requirement). Deactivate and
  // revoke sessions so the account cannot be used.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date(), isActive: false },
    }),
    prisma.refreshToken.deleteMany({ where: { userId } }),
  ]);

  logAudit(event, {
    userId: auth.userId,
    action: AuditActions.USER_DELETED,
    entityType: "user",
    entityId: userId,
    oldValues: { email: target.email },
  });

  return { success: true, message: "User deleted" };
});
