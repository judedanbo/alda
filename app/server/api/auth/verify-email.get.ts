import prisma from "~/server/utils/prisma";
import { logAudit, AuditActions } from "~/server/utils/audit";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const token = query.token as string;

  if (!token) {
    throw createError({
      statusCode: 400,
      message: "Verification token is required",
    });
  }

  const verificationToken = await prisma.emailVerificationToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!verificationToken) {
    throw createError({
      statusCode: 400,
      message: "Invalid verification token",
    });
  }

  if (verificationToken.usedAt) {
    throw createError({
      statusCode: 400,
      message: "This verification link has already been used",
    });
  }

  if (verificationToken.expiresAt < new Date()) {
    throw createError({
      statusCode: 400,
      message: "This verification link has expired. Please request a new one.",
    });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: verificationToken.userId },
      data: { emailVerified: true },
    }),
    prisma.emailVerificationToken.update({
      where: { id: verificationToken.id },
      data: { usedAt: new Date() },
    }),
  ]);

  logAudit(event, {
    userId: verificationToken.userId,
    action: AuditActions.EMAIL_VERIFIED,
    entityType: "user",
    entityId: verificationToken.userId,
    newValues: { emailVerified: true },
  });

  return {
    success: true,
    message: "Email verified successfully. You can now log in.",
  };
});
