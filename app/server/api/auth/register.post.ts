import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import prisma from "~/server/utils/prisma";
import { validateBody, registerSchema } from "~/server/utils/validators";
import { generateTokenPair, getTokenExpiry } from "~/server/utils/jwt";
import { createAuditLog, AuditActions } from "~/server/utils/audit";
import { sendWelcomeEmail, sendVerificationEmail } from "~/server/services/email.service";
import { generateVerificationToken } from "~/server/utils/code-generator";
import { ghanaPhoneAlternates, isGhanaPhone, normalizePhoneE164 } from "~/server/utils/phone";

export default defineEventHandler(async (event) => {
  // Validate request body
  const { email, password, phone } = await validateBody(event, registerSchema);

  const normalizedPhone = phone ? (normalizePhoneE164(phone) ?? undefined) : undefined;

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

  if (normalizedPhone) {
    const candidates = isGhanaPhone(normalizedPhone)
      ? ghanaPhoneAlternates(normalizedPhone)
      : [normalizedPhone];
    const phoneOwner = await prisma.user.findFirst({
      where: { phone: { in: candidates } },
      select: { id: true },
    });
    if (phoneOwner) {
      throw createError({
        statusCode: 409,
        statusMessage: "Conflict",
        data: {
          fieldErrors: { phone: ["This phone number is already registered"] },
          formErrors: [],
        },
      });
    }
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
  // L-1: bcrypt cost 13 (one doubling above OWASP's high-security baseline
  // of 12). Argon2id is the modern recommendation but bcryptjs without a
  // new dependency keeps the surface tight.
  const passwordHash = await bcrypt.hash(password, 13);

  // Create user with applicant role
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      phone: normalizedPhone,
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

  // Store refresh token. New registration starts a fresh token family;
  // the familyId is inherited across rotations and torn down on replay.
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: tokens.refreshToken,
      familyId: randomUUID(),
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

  // Create email verification token
  const verificationToken = generateVerificationToken();
  const verificationExpiry = new Date();
  verificationExpiry.setHours(verificationExpiry.getHours() + 24);

  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      token: verificationToken,
      expiresAt: verificationExpiry,
    },
  });

  // Send emails (non-blocking)
  try {
    await sendWelcomeEmail(user.email, user.email);
    await sendVerificationEmail(user.email, user.email, verificationToken);
  } catch (e) {
    console.error("Failed to send registration emails:", e);
  }

  return {
    success: true,
    message: "Registration successful",
    data: {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        phoneVerifiedAt: user.phoneVerifiedAt,
        roles,
      },
      tokens,
    },
  };
});
