import prisma from "~/server/utils/prisma";
import { createAuditLog } from "~/server/utils/audit";

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
  const body = await readBody(event);
  const { roleIds } = body as { roleIds: number[] };

  if (!userId) {
    throw createError({
      statusCode: 400,
      statusMessage: "User ID is required",
    });
  }

  if (!Array.isArray(roleIds)) {
    throw createError({
      statusCode: 400,
      statusMessage: "roleIds must be an array",
    });
  }

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

  const newRoles = await prisma.role.findMany({
    where: { id: { in: roleIds } },
  });

  await createAuditLog({
    userId: auth.userId,
    action: "ROLE_ASSIGN",
    entityType: "User",
    entityId: userId,
    oldValues: { roles: oldRoles },
    newValues: { roles: newRoles.map((r) => r.name) },
    event,
  });

  return {
    success: true,
    message: "User roles updated successfully",
  };
});
