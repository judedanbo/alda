import prisma from "~/server/utils/prisma";
import { logAction, AuditActions } from "~/server/utils/audit";
import { validateBody, adminUserRolesSchema } from "~/server/utils/validators";

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

  const userId = getRouterParam(event, "id");
  if (!userId) {
    throw createError({
      statusCode: 400,
      statusMessage: "User ID is required",
    });
  }

  const { roleIds } = await validateBody(event, adminUserRolesSchema);

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: { include: { role: true } },
    },
  });

  if (!targetUser) {
    throw createError({
      statusCode: 404,
      statusMessage: "User not found",
    });
  }

  const oldRoles = targetUser.roles.map((r) => r.role.name);

  // Resolve the requested role records up front — used for the guard and audit.
  const newRoleRecords = await prisma.role.findMany({ where: { id: { in: roleIds } } });
  const newRoleNames = newRoleRecords.map((r) => r.name);

  // Self-lockout guard: an admin cannot strip their own admin role.
  if (userId === auth.userId && !newRoleNames.includes("admin")) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "You cannot remove your own admin role",
    });
  }

  // Delete existing roles and create new ones
  await prisma.$transaction([
    prisma.userRole.deleteMany({
      where: { userId },
    }),
    prisma.userRole.createMany({
      data: roleIds.map((roleId) => ({
        userId,
        roleId,
      })),
    }),
  ]);

  await logAction({
    userId: auth.userId,
    action: AuditActions.USER_ROLE_CHANGED,
    entityType: "User",
    entityId: userId,
    oldValues: { roles: oldRoles },
    newValues: { roles: newRoleNames },
    event,
  });

  return {
    success: true,
    message: "User roles updated successfully",
  };
});
