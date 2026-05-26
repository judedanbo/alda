import { randomInt } from "node:crypto";
import prisma from "~/server/utils/prisma";
import { createAuditLog, AuditActions } from "~/server/utils/audit";
import { sendSms } from "~/server/services/sms.service";
import { BRAND } from "~/server/utils/branding";

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_THROTTLE_MS = 60 * 1000; // 60 seconds

function generateNumericCode(digits = 6): string {
  // M-4: `randomInt(max)` uses rejection sampling internally, so the
  // distribution is uniform over [0, 10^digits) — no modulo bias like the
  // old `getRandomValues % max` implementation (which slightly favoured
  // the low end of the range).
  const max = 10 ** digits;
  return randomInt(max).toString().padStart(digits, "0");
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, message: "Authentication required" });
  }

  const user = await prisma.user.findUnique({ where: { id: auth.userId } });
  if (!user) {
    throw createError({ statusCode: 404, message: "User not found" });
  }

  if (user.phoneVerified) {
    return {
      success: true,
      message: "Phone is already verified",
      data: { expiresAt: null as string | null },
    };
  }

  if (!user.phone) {
    throw createError({
      statusCode: 400,
      message: "Add a phone number to your account before requesting a code",
    });
  }

  // Throttle — match the 60s window the dashboard banner counts down.
  const recentToken = await prisma.phoneVerificationToken.findFirst({
    where: {
      userId: user.id,
      createdAt: { gte: new Date(Date.now() - RESEND_THROTTLE_MS) },
    },
    orderBy: { createdAt: "desc" },
  });

  if (recentToken) {
    const retryInSec = Math.max(
      1,
      Math.ceil((recentToken.createdAt.getTime() + RESEND_THROTTLE_MS - Date.now()) / 1000),
    );
    throw createError({
      statusCode: 429,
      statusMessage: "Too Many Requests",
      data: { retryInSec },
      message: `Please wait ${retryInSec}s before requesting another code`,
    });
  }

  // Invalidate prior outstanding tokens — only one live code at a time.
  await prisma.phoneVerificationToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const code = generateNumericCode(6);
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  await prisma.phoneVerificationToken.create({
    data: { userId: user.id, code, expiresAt },
  });

  const message = `${BRAND.shortName} verification code: ${code}. Expires in 10 minutes. Do not share this code.`;
  const result = await sendSms(user.phone, message);

  await createAuditLog(event, {
    userId: user.id,
    action: AuditActions.PHONE_CODE_REQUESTED,
    entityType: "user",
    entityId: user.id,
    newValues: {
      provider: result.provider ?? null,
      success: result.success,
      error: result.success ? null : result.error,
    },
  });

  if (!result.success) {
    throw createError({
      statusCode: 502,
      statusMessage: "Bad Gateway",
      message: result.error || "Failed to send SMS",
    });
  }

  return {
    success: true,
    message: "Verification code sent",
    data: { expiresAt: expiresAt.toISOString() as string | null },
  };
});
