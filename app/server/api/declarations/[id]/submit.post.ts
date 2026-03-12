import prisma from "~/server/utils/prisma";
import { createAuditLog, AuditActions } from "~/server/utils/audit";
import { notifyDeclarationSubmitted } from "~/server/services/notification.service";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;

  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Declaration ID is required",
    });
  }

  // Get user's profile
  const profile = await prisma.applicantProfile.findUnique({
    where: { userId: auth.userId },
  });

  if (!profile) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Profile not found",
    });
  }

  // Get declaration
  const declaration = await prisma.declaration.findUnique({
    where: { id },
    include: {
      applicant: true,
    },
  });

  if (!declaration) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Declaration not found",
    });
  }

  // Verify ownership
  if (declaration.applicantId !== profile.id) {
    throw createError({
      statusCode: 403,
      statusMessage: "Forbidden",
      message: "You can only submit your own declarations",
    });
  }

  // Verify status allows submission
  if (declaration.status !== "PENDING") {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: `Cannot submit declaration with status: ${declaration.status}`,
    });
  }

  // Update declaration status
  const updated = await prisma.declaration.update({
    where: { id },
    data: {
      status: "SUBMITTED",
      submittedAt: new Date(),
    },
  });

  // Create audit log
  await createAuditLog(event, {
    userId: auth.userId,
    action: AuditActions.DECLARATION_SUBMITTED,
    entityType: "declaration",
    entityId: id,
    oldValues: { status: declaration.status },
    newValues: { status: "SUBMITTED", submittedAt: updated.submittedAt },
  });

  // Send notification
  await notifyDeclarationSubmitted(
    auth.userId,
    declaration.uniqueCode,
    profile.fullName
  );

  return {
    success: true,
    message: "Declaration submitted successfully",
    data: {
      id: updated.id,
      uniqueCode: updated.uniqueCode,
      status: updated.status,
      submittedAt: updated.submittedAt,
    },
  };
});
