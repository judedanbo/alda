import prisma from "~/server/utils/prisma";
import { validateBody, submissionRecordSchema } from "~/server/utils/validators";
import { logAction } from "~/server/utils/audit";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;

  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  // Check if user is a schedule officer or admin
  const userRoles = await prisma.userRole.findMany({
    where: { userId: auth.userId },
    include: { role: true },
  });

  const allowedRoles = ["schedule_officer", "admin"];
  const hasAccess = userRoles.some((ur) => allowedRoles.includes(ur.role.name));

  if (!hasAccess) {
    throw createError({
      statusCode: 403,
      statusMessage: "Access denied. Schedule Officer or Admin role required.",
    });
  }

  const data = await validateBody(event, submissionRecordSchema);

  // Get the declaration
  const declaration = await prisma.declaration.findUnique({
    where: { id: data.declarationId },
    include: {
      applicant: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!declaration) {
    throw createError({
      statusCode: 404,
      statusMessage: "Declaration not found",
    });
  }

  // Check if declaration is in the correct status
  if (declaration.status !== "SUBMITTED") {
    throw createError({
      statusCode: 400,
      statusMessage: `Cannot record submission. Declaration status is ${declaration.status}, expected SUBMITTED.`,
    });
  }

  // Check if submission already exists
  const existingSubmission = await prisma.submission.findFirst({
    where: { declarationId: data.declarationId },
  });

  if (existingSubmission) {
    throw createError({
      statusCode: 400,
      statusMessage: "Submission already recorded for this declaration",
    });
  }

  // Create submission and update declaration status
  const [submission] = await prisma.$transaction([
    prisma.submission.create({
      data: {
        declarationId: data.declarationId,
        recordedById: auth.userId,
        submissionDate: new Date(),
        notes: data.notes,
      },
      include: {
        declaration: {
          include: {
            applicant: true,
          },
        },
        recordedBy: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    }),
    prisma.declaration.update({
      where: { id: data.declarationId },
      data: { status: "UNDER_REVIEW" },
    }),
    prisma.declarationStatusHistory.create({
      data: {
        declarationId: data.declarationId,
        status: "UNDER_REVIEW",
        changedById: auth.userId,
        notes: "Submission recorded by GAS officer",
      },
    }),
  ]);

  // Log the action
  await logAction({
    userId: auth.userId,
    action: "SUBMISSION_RECORDED",
    entityType: "submission",
    entityId: submission.id,
    newValues: { declarationId: data.declarationId, notes: data.notes },
    event,
  });

  // Create notification for applicant
  if (declaration.applicant.user) {
    await prisma.notification.create({
      data: {
        userId: declaration.applicant.user.id,
        type: "SUBMISSION_RECORDED",
        title: "Declaration Received",
        message: `Your asset declaration (${declaration.uniqueCode}) has been received and is now under review.`,
        metadata: {
          declarationId: declaration.id,
          uniqueCode: declaration.uniqueCode,
        },
      },
    });
  }

  return {
    success: true,
    message: "Submission recorded successfully",
    data: submission,
  };
});
