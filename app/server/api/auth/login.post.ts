import bcrypt from "bcryptjs";
import prisma from "~/server/utils/prisma";
import { validateBody, loginSchema } from "~/server/utils/validators";
import { generateTokenPair, getTokenExpiry } from "~/server/utils/jwt";
import { createAuditLog, AuditActions } from "~/server/utils/audit";

export default defineEventHandler(async (event) => {
  // Validate request body
  const { email, password } = await validateBody(event, loginSchema);

  // Find user
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      roles: {
        include: {
          role: true,
        },
      },
    },
  });

  if (!user) {
    // Create audit log for failed attempt
    await createAuditLog(event, {
      action: AuditActions.USER_LOGIN_FAILED,
      newValues: { email: email.toLowerCase(), reason: "user_not_found" },
    });

    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
      message: "Invalid email or password",
    });
  }

  // Check if user is active
  if (!user.isActive) {
    await createAuditLog(event, {
      userId: user.id,
      action: AuditActions.USER_LOGIN_FAILED,
      newValues: { reason: "account_inactive" },
    });

    throw createError({
      statusCode: 403,
      statusMessage: "Forbidden",
      message: "Your account has been deactivated. Please contact support.",
    });
  }

  // Verify password
  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    await createAuditLog(event, {
      userId: user.id,
      action: AuditActions.USER_LOGIN_FAILED,
      newValues: { reason: "invalid_password" },
    });

    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
      message: "Invalid email or password",
    });
  }

  // Generate tokens
  const roles = user.roles.map((r) => r.role.name);
  const config = useRuntimeConfig();
  const tokens = generateTokenPair({
    userId: user.id,
    email: user.email,
    roles,
  });

  // Store refresh token (remove old ones first)
  await prisma.refreshToken.deleteMany({
    where: { userId: user.id },
  });

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: tokens.refreshToken,
      expiresAt: getTokenExpiry(config.jwtRefreshExpiresIn || "7d"),
    },
  });

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  // Create audit log
  await createAuditLog(event, {
    userId: user.id,
    action: AuditActions.USER_LOGIN,
    entityType: "user",
    entityId: user.id,
  });

  // Check if user has applicant profile
  const profile = await prisma.applicantProfile.findUnique({
    where: { userId: user.id },
    select: {
      fullName: true,
      verificationStatus: true,
    },
  });

  return {
    success: true,
    message: "Login successful",
    data: {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        emailVerified: user.emailVerified,
        roles,
        hasProfile: !!profile,
        fullName: profile?.fullName,
        verificationStatus: profile?.verificationStatus,
      },
      tokens,
    },
  };
});
