import prisma from "~/server/utils/prisma";
import { validateBody, acceptInviteSchema } from "~/server/utils/validators";
import { logAudit, AuditActions } from "~/server/utils/audit";

/**
 * Step 1 of the staff-invite flow. Validates the invite token (a
 * PasswordResetToken) and marks the user's email verified — but does NOT
 * consume the token. The set-password form then posts the same token to
 * /api/auth/reset-password, which consumes it.
 */
export default defineEventHandler(async (event) => {
  const { token } = await validateBody(event, acceptInviteSchema);

  const inviteToken = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: true },
  });

  const invalid = () =>
    createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "This invitation link is invalid or has expired. Ask an administrator to resend it.",
    });

  if (!inviteToken) throw invalid();
  if (inviteToken.expiresAt < new Date()) throw invalid();
  if (inviteToken.usedAt) throw invalid();

  if (!inviteToken.user.emailVerified) {
    await prisma.user.update({
      where: { id: inviteToken.userId },
      data: { emailVerified: true },
    });

    logAudit(event, {
      userId: inviteToken.userId,
      action: AuditActions.INVITE_ACCEPTED,
      entityType: "user",
      entityId: inviteToken.userId,
      newValues: { emailVerified: true },
    });
  }

  return { success: true, email: inviteToken.user.email };
});
