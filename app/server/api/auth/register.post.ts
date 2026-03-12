import bcrypt from "bcryptjs";
import prisma from "~/server/utils/prisma";
import { validateBody, registerSchema } from "~/server/utils/validators";
import { generateTokenPair, getTokenExpiry } from "~/server/utils/jwt";
import { createAuditLog, AuditActions } from "~/server/utils/audit";

export default defineEventHandler(async (event) => {
  // Validate request body
  const { email, password, phone } = await validateBody(event, registerSchema);

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (existingUser) {
    throw createError({
      statusCode: 409,
      statusMessage: "Conflict",
      message: "An account with this email already exists",
    });
  }

  // Get the applicant role
  const applicantRole = await prisma.role.findUnique({
    where: { name: "applicant" },
  });

  if (!applicantRole) {
    throw createError({
      statusCode: 500,
      statusMessage: "Internal Server Error",
      message: "System configuration error: applicant role not found",
    });
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 12);

  // Create user with applicant role
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      phone,
      roles: {
        create: {
          roleId: applicantRole.id,
        },
      },
    },
    include: {
      roles: {
        include: {
          role: true,
        },
      },
    },
  });

  // Create notification preferences
  await prisma.notificationPreference.create({
    data: {
      userId: user.id,
      emailEnabled: true,
      smsEnabled: true,
      inAppEnabled: true,
    },
  });

  // Generate tokens
  const roles = user.roles.map((r) => r.role.name);
  const config = useRuntimeConfig();
  const tokens = generateTokenPair({
    userId: user.id,
    email: user.email,
    roles,
  });

  // Store refresh token
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: tokens.refreshToken,
      expiresAt: getTokenExpiry(config.jwtRefreshExpiresIn || "7d"),
    },
  });

  // Create audit log
  await createAuditLog(event, {
    userId: user.id,
    action: AuditActions.USER_REGISTERED,
    entityType: "user",
    entityId: user.id,
    newValues: { email: user.email, phone: user.phone },
  });

  // TODO: Send verification email

  return {
    success: true,
    message: "Registration successful",
    data: {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        emailVerified: user.emailVerified,
        roles,
      },
      tokens,
    },
  };
});
