import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import prisma from "~/server/utils/prisma";
import { validateBody, loginSchema } from "~/server/utils/validators";
import { generateTokenPair, getTokenExpiry } from "~/server/utils/jwt";
import { createAuditLog, AuditActions } from "~/server/utils/audit";
import {
  isAccountLocked,
  recordLoginFailure,
  clearLoginFailures,
} from "~/server/utils/auth-lockout";

// Computed once at module load so the user-not-found path can run a real
// bcrypt.compare and stay timing-equivalent to the wrong-password path.
// The plaintext is meaningless — it never matches a real password.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("invalid-timing-equalizer", 12);

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
    // Run bcrypt.compare against a constant dummy hash so the response
    // time matches the wrong-password branch below — closes the user-
    // enumeration timing leak. The result is discarded.
    await bcrypt.compare(password, DUMMY_PASSWORD_HASH);

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

  // Per-account brute-force lockout — refuses the request before bcrypt runs
  // when the account is in the cool-down window. The per-IP rate-limit
  // already lives in middleware; this is the per-identity complement.
  const lockState = await isAccountLocked(user.id);
  if (lockState.locked) {
    await createAuditLog(event, {
      userId: user.id,
      action: AuditActions.USER_LOGIN_FAILED,
      newValues: { reason: "account_locked", unlockAt: lockState.unlockAt },
    });
    const retryAfterMs = Math.max(1000, Date.parse(lockState.unlockAt!) - Date.now());
    setResponseHeader(event, "Retry-After", String(Math.ceil(retryAfterMs / 1000)));
    throw createError({
      statusCode: 429,
      statusMessage: "Too Many Requests",
      message: "Too many failed login attempts. Try again later.",
      data: { unlockAt: lockState.unlockAt },
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
    // Increment the per-account failure counter; if this trips the
    // threshold the next attempt will hit the lockout gate above.
    await recordLoginFailure(user.id);

    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
      message: "Invalid email or password",
    });
  }

  // Authentication succeeded — clear any accumulated failure state so a
  // long-lived legitimate user never carries stale counters forward.
  await clearLoginFailures(user.id);

  // Generate tokens
  const roles = user.roles.map((r) => r.role.name);
  const config = useRuntimeConfig();
  const tokens = generateTokenPair({
    userId: user.id,
    email: user.email,
    roles,
  });

  // Store refresh token. Each login starts a fresh family; the family is
  // inherited across rotations and torn down on replay detection.
  await prisma.refreshToken.deleteMany({
    where: { userId: user.id },
  });

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: tokens.refreshToken,
      familyId: randomUUID(),
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
        phoneVerified: user.phoneVerified,
        phoneVerifiedAt: user.phoneVerifiedAt,
        roles,
        hasProfile: !!profile,
        fullName: profile?.fullName,
        verificationStatus: profile?.verificationStatus,
      },
      tokens,
    },
  };
});
