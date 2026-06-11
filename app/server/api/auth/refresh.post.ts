import { randomUUID } from "node:crypto";
import prisma from "~/server/utils/prisma";
import { verifyRefreshToken, generateTokenPair, getTokenExpiry } from "~/server/utils/jwt";
import { logAudit, AuditActions } from "~/server/utils/audit";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { refreshToken } = body;

  if (!refreshToken) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Refresh token is required",
    });
  }

  // Verify the refresh token signature
  const payload = verifyRefreshToken(refreshToken);
  if (!payload) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
      message: "Invalid or expired refresh token",
    });
  }

  // Check if token exists in database and is not expired
  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: {
      user: {
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
      },
    },
  });

  if (!storedToken) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
      message: "Refresh token not found or has been revoked",
    });
  }

  // Replay detection. A token whose row has `consumedAt` set was already
  // rotated out — presenting it again means either the legitimate browser
  // is re-trying after a network blip OR an attacker who stole the old
  // token is using it. We can't distinguish, so we err on the side of
  // safety: tear down every token in the family and force re-login.
  if (storedToken.consumedAt) {
    if (storedToken.familyId) {
      await prisma.refreshToken.deleteMany({
        where: { familyId: storedToken.familyId },
      });
    } else {
      // Pre-migration token with no familyId — be conservative and wipe
      // every refresh token for this user.
      await prisma.refreshToken.deleteMany({
        where: { userId: storedToken.userId },
      });
    }
    logAudit(event, {
      userId: storedToken.userId,
      action: AuditActions.REFRESH_TOKEN_REPLAY_DETECTED,
      entityType: "refresh_token",
      entityId: storedToken.id,
      newValues: { familyId: storedToken.familyId },
    });
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
      message: "Refresh token has already been used. Please log in again.",
    });
  }

  if (storedToken.expiresAt < new Date()) {
    await prisma.refreshToken.delete({
      where: { id: storedToken.id },
    });

    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
      message: "Refresh token has expired",
    });
  }

  // Check if user is still active
  if (!storedToken.user.isActive) {
    await prisma.refreshToken.delete({
      where: { id: storedToken.id },
    });

    throw createError({
      statusCode: 403,
      statusMessage: "Forbidden",
      message: "Your account has been deactivated",
    });
  }

  // Generate new tokens
  const roles = storedToken.user.roles.map((r) => r.role.name);
  const config = useRuntimeConfig();
  const tokens = generateTokenPair({
    userId: storedToken.user.id,
    email: storedToken.user.email,
    roles,
  });

  // Mark the consumed token (don't delete — replay detection above needs
  // to find it) and issue a fresh row in the same family. Pre-migration
  // tokens get a brand-new familyId here.
  const familyId = storedToken.familyId ?? randomUUID();
  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { consumedAt: new Date() },
    }),
    prisma.refreshToken.create({
      data: {
        userId: storedToken.user.id,
        token: tokens.refreshToken,
        familyId,
        expiresAt: getTokenExpiry(config.jwtRefreshExpiresIn || "7d"),
      },
    }),
  ]);

  return {
    success: true,
    message: "Tokens refreshed successfully",
    data: {
      tokens,
    },
  };
});
