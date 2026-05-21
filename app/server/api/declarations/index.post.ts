import prisma from "~/server/utils/prisma";
import { generateUniqueCode } from "~/server/utils/code-generator";
import { createAuditLog, AuditActions } from "~/server/utils/audit";
import { notifyUniqueCodeGenerated } from "~/server/services/notification.service";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;

  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  // Get user's applicant profile
  const profile = await prisma.applicantProfile.findUnique({
    where: { userId: auth.userId },
    include: {
      user: true,
    },
  });

  if (!profile) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Please complete your profile first",
    });
  }

  if (!profile.user.emailVerified) {
    throw createError({
      statusCode: 403,
      statusMessage: "Forbidden",
      message: "Please verify your email address before creating a declaration",
    });
  }

  // Check verification status
  if (profile.verificationStatus !== "VERIFIED") {
    throw createError({
      statusCode: 403,
      statusMessage: "Forbidden",
      message: "Your registration must be verified before creating declarations",
    });
  }

  // Check for pending or in-review declarations
  const existingPending = await prisma.declaration.findFirst({
    where: {
      applicantId: profile.id,
      status: {
        in: ["CODE_GENERATED", "FORM_COLLECTED", "SUBMITTED", "UNDER_REVIEW", "APPROVED"],
      },
    },
  });

  if (existingPending) {
    throw createError({
      statusCode: 409,
      statusMessage: "Conflict",
      message: `You already have a pending declaration (${existingPending.uniqueCode}). Please wait for it to be processed.`,
    });
  }

  // Generate unique code
  let uniqueCode = generateUniqueCode();

  // Ensure uniqueness (very unlikely to collide, but check anyway)
  let attempts = 0;
  while (attempts < 5) {
    const existing = await prisma.declaration.findUnique({
      where: { uniqueCode },
    });
    if (!existing) break;
    uniqueCode = generateUniqueCode();
    attempts++;
  }

  // Create declaration
  const declaration = await prisma.declaration.create({
    data: {
      applicantId: profile.id,
      uniqueCode,
      status: "CODE_GENERATED",
    },
  });

  // Create audit log
  await createAuditLog(event, {
    userId: auth.userId,
    action: AuditActions.DECLARATION_CREATED,
    entityType: "declaration",
    entityId: declaration.id,
    newValues: {
      uniqueCode,
      applicantId: profile.id,
    },
  });

  // Send notification with unique code
  await notifyUniqueCodeGenerated(auth.userId, uniqueCode, profile.fullName);

  return {
    success: true,
    message: "Declaration created successfully",
    data: {
      id: declaration.id,
      uniqueCode: declaration.uniqueCode,
      status: declaration.status,
      createdAt: declaration.createdAt,
    },
  };
});
