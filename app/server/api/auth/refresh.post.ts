import prisma from "~/server/utils/prisma";
import { verifyRefreshToken, generateTokenPair, getTokenExpiry } from "~/server/utils/jwt";

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

  if (storedToken.expiresAt < new Date()) {
    // Delete expired token
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

  // Delete old refresh token and create new one
  await prisma.refreshToken.delete({
    where: { id: storedToken.id },
  });

  await prisma.refreshToken.create({
    data: {
      userId: storedToken.user.id,
      token: tokens.refreshToken,
      expiresAt: getTokenExpiry(config.jwtRefreshExpiresIn || "7d"),
    },
  });

  return {
    success: true,
    message: "Tokens refreshed successfully",
    data: {
      tokens,
    },
  };
});
