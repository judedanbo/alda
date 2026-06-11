import prisma from "~/server/utils/prisma";
import { logAudit, AuditActions } from "~/server/utils/audit";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;

  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
      message: "Not authenticated",
    });
  }

  // Delete all refresh tokens for this user
  await prisma.refreshToken.deleteMany({
    where: { userId: auth.userId },
  });

  // Create audit log
  logAudit(event, {
    userId: auth.userId,
    action: AuditActions.USER_LOGOUT,
    entityType: "user",
    entityId: auth.userId,
  });

  return {
    success: true,
    message: "Logged out successfully",
  };
});
