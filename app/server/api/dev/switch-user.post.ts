import prisma from "~/server/utils/prisma";
import { generateTokenPair, getTokenExpiry } from "~/server/utils/jwt";

export default defineEventHandler(async (event) => {
  if (process.env.NODE_ENV === "production") {
    throw createError({ statusCode: 404, statusMessage: "Not Found" });
  }

  const body = await readBody(event);
  const email = body?.email;

  if (!email || typeof email !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Email is required",
    });
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      roles: {
        include: { role: true },
      },
    },
  });

  if (!user) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "User not found",
    });
  }

  const roles = user.roles.map((r) => r.role.name);
  const config = useRuntimeConfig();
  const tokens = generateTokenPair({ userId: user.id, email: user.email, roles });

  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: tokens.refreshToken,
      expiresAt: getTokenExpiry(config.jwtRefreshExpiresIn || "7d"),
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const hasProfile = await prisma.applicantProfile.findUnique({
    where: { userId: user.id },
  });

  return {
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        emailVerified: user.emailVerified,
        roles,
        hasProfile: !!hasProfile,
      },
      tokens,
    },
  };
});
