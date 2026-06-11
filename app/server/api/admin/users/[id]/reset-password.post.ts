import prisma from "~/server/utils/prisma";
import { createAuditLog, AuditActions } from "~/server/utils/audit";
import { generateResetToken } from "~/server/utils/code-generator";
import { sendPasswordResetEmail } from "~/server/services/email.service";

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

  const target = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true, email: true },
  });
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: "User not found" });
  }

  // Fresh 1h reset token; drop any prior tokens for this user (mirrors the
  // self-serve forgot-password flow, which uses the same table + reset page).
  const token = generateResetToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1);
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId } }),
    prisma.passwordResetToken.create({ data: { userId, token, expiresAt } }),
  ]);

  await createAuditLog(event, {
    userId: auth.userId,
    action: AuditActions.USER_PASSWORD_RESET_SENT,
    entityType: "user",
    entityId: userId,
  });

  const emailSent = await sendPasswordResetEmail(target.email, target.email, token);

  return {
    success: true,
    emailSent,
    message: emailSent
      ? "Password reset link sent"
      : "Reset link generated, but the email could not be sent — check email (SMTP) configuration.",
  };
});
