import prisma from "~/server/utils/prisma";
import { generateVerificationToken } from "~/server/utils/code-generator";
import { sendVerificationEmail } from "~/server/services/email.service";
import { logAudit, AuditActions } from "~/server/utils/audit";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, message: "Authentication required" });
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
  });

  if (!user) {
    throw createError({ statusCode: 404, message: "User not found" });
  }

  if (user.emailVerified) {
    return { success: true, message: "Email is already verified" };
  }

  // Rate limit: check if a token was created in the last 2 minutes
  const recentToken = await prisma.emailVerificationToken.findFirst({
    where: {
      userId: user.id,
      createdAt: { gte: new Date(Date.now() - 2 * 60 * 1000) },
    },
  });

  if (recentToken) {
    throw createError({
      statusCode: 429,
      message: "Please wait 2 minutes before requesting another verification email",
    });
  }

  // Invalidate old tokens
  await prisma.emailVerificationToken.deleteMany({
    where: { userId: user.id },
  });

  // Create new token
  const token = generateVerificationToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  await prisma.emailVerificationToken.create({
    data: { userId: user.id, token, expiresAt },
  });

  try {
    await sendVerificationEmail(user.email, user.email, token);
  } catch (e) {
    console.error("Failed to send verification email:", e);
  }

  logAudit(event, {
    userId: user.id,
    action: AuditActions.VERIFICATION_RESENT,
    entityType: "user",
    entityId: user.id,
  });

  return {
    success: true,
    message: "Verification email sent. Please check your inbox.",
  };
});
