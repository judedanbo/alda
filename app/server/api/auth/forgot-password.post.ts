import prisma from "~/server/utils/prisma";
import { validateBody, forgotPasswordSchema } from "~/server/utils/validators";
import { generateResetToken } from "~/server/utils/code-generator";
import { createAuditLog, AuditActions } from "~/server/utils/audit";
import { sendPasswordResetEmail } from "~/server/services/email.service";

export default defineEventHandler(async (event) => {
  const { email } = await validateBody(event, forgotPasswordSchema);

  // Find user
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  // Always return success to prevent email enumeration
  if (!user) {
    return {
      success: true,
      message: "If an account with that email exists, a password reset link has been sent",
    };
  }

  // Delete any existing reset tokens for this user
  await prisma.passwordResetToken.deleteMany({
    where: { userId: user.id },
  });

  // Generate reset token
  const token = generateResetToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1); // Token valid for 1 hour

  // Store reset token
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      token,
      expiresAt,
    },
  });

  // Create audit log
  await createAuditLog(event, {
    userId: user.id,
    action: AuditActions.PASSWORD_RESET_REQUESTED,
    entityType: "user",
    entityId: user.id,
  });

  try {
    await sendPasswordResetEmail(user.email, user.email, token);
  } catch (e) {
    console.error("Failed to send password reset email:", e);
  }

  return {
    success: true,
    message: "If an account with that email exists, a password reset link has been sent",
  };
});
