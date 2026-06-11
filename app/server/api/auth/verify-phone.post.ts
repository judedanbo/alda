import { z } from "zod";
import prisma from "~/server/utils/prisma";
import { validateBody } from "~/server/utils/validators";
import { logAudit, AuditActions } from "~/server/utils/audit";

const MAX_ATTEMPTS = 5;

const bodySchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
});

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, message: "Authentication required" });
  }

  const { code } = await validateBody(event, bodySchema);

  const user = await prisma.user.findUnique({ where: { id: auth.userId } });
  if (!user) {
    throw createError({ statusCode: 404, message: "User not found" });
  }

  if (user.phoneVerified) {
    return { success: true, message: "Phone is already verified" };
  }

  const token = await prisma.phoneVerificationToken.findFirst({
    where: { userId: user.id, usedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!token) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "No active verification code. Request a new one.",
    });
  }

  if (token.expiresAt.getTime() <= Date.now()) {
    await prisma.phoneVerificationToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    });
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "This code has expired. Request a new one.",
    });
  }

  if (token.code !== code) {
    const nextAttempts = token.attempts + 1;
    const exhausted = nextAttempts >= MAX_ATTEMPTS;
    await prisma.phoneVerificationToken.update({
      where: { id: token.id },
      data: {
        attempts: nextAttempts,
        usedAt: exhausted ? new Date() : null,
      },
    });

    logAudit(event, {
      userId: user.id,
      action: AuditActions.PHONE_VERIFICATION_FAILED,
      entityType: "user",
      entityId: user.id,
      newValues: { attempts: nextAttempts, exhausted },
    });

    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: exhausted
        ? "Too many incorrect attempts. Request a new code."
        : `Incorrect code. ${MAX_ATTEMPTS - nextAttempts} attempt${MAX_ATTEMPTS - nextAttempts === 1 ? "" : "s"} remaining.`,
    });
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.phoneVerificationToken.update({
      where: { id: token.id },
      data: { usedAt: now },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { phoneVerified: true, phoneVerifiedAt: now },
    }),
  ]);

  logAudit(event, {
    userId: user.id,
    action: AuditActions.PHONE_VERIFIED,
    entityType: "user",
    entityId: user.id,
    newValues: { phoneVerifiedAt: now.toISOString() },
  });

  return {
    success: true,
    message: "Phone number verified",
    data: { phoneVerifiedAt: now.toISOString() },
  };
});
