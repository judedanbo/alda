import prisma from "~/server/utils/prisma";
import { logAction, AuditActions } from "~/server/utils/audit";
import { validateBody, adminUserStatusSchema } from "~/server/utils/validators";

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

  const { isActive } = await validateBody(event, adminUserStatusSchema);

  // Prevent admin from deactivating themselves
  if (userId === auth.userId && !isActive) {
    throw createError({
      statusCode: 400,
      statusMessage: "You cannot deactivate your own account",
    });
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!targetUser) {
    throw createError({
      statusCode: 404,
      statusMessage: "User not found",
    });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { isActive },
  });

  await logAction({
    userId: auth.userId,
    action: isActive ? AuditActions.USER_REACTIVATED : AuditActions.USER_DEACTIVATED,
    entityType: "User",
    entityId: userId,
    oldValues: { isActive: targetUser.isActive },
    newValues: { isActive },
    event,
  });

  return {
    success: true,
    message: `User ${isActive ? "activated" : "deactivated"} successfully`,
  };
});
