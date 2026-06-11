import bcrypt from "bcryptjs";
import prisma from "~/server/utils/prisma";
import { validateBody, resetPasswordSchema } from "~/server/utils/validators";
import { logAudit, AuditActions } from "~/server/utils/audit";

export default defineEventHandler(async (event) => {
  const { token, password } = await validateBody(event, resetPasswordSchema);

  // Find the reset token
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!resetToken) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Invalid or expired reset token",
    });
  }

  // Check if token has expired
  if (resetToken.expiresAt < new Date()) {
    await prisma.passwordResetToken.delete({
      where: { id: resetToken.id },
    });

    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Reset token has expired. Please request a new one.",
    });
  }

  // Check if token has already been used
  if (resetToken.usedAt) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "This reset token has already been used",
    });
  }

  // Hash new password. L-1: bcrypt cost 13 must match the cost used at
  // register time so resets don't downgrade hash strength.
  const passwordHash = await bcrypt.hash(password, 13);

  // Update user password and mark token as used
  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
    // Revoke all refresh tokens for security
    prisma.refreshToken.deleteMany({
      where: { userId: resetToken.userId },
    }),
  ]);

  // Create audit log
  logAudit(event, {
    userId: resetToken.userId,
    action: AuditActions.PASSWORD_RESET_COMPLETED,
    entityType: "user",
    entityId: resetToken.userId,
  });

  return {
    success: true,
    message: "Password has been reset successfully. Please login with your new password.",
  };
});
