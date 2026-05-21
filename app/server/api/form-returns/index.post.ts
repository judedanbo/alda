import prisma from "~/server/utils/prisma";
import { validateBody, formReturnRecordSchema } from "~/server/utils/validators";
import { logAction, AuditActions } from "~/server/utils/audit";
import { notifyDeclarationSubmitted } from "~/server/services/notification.service";

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

  const data = await validateBody(event, formReturnRecordSchema);

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
  if (declaration.status !== "FORM_COLLECTED") {
    throw createError({
      statusCode: 400,
      statusMessage: `Cannot record form return. Declaration status is ${declaration.status}, expected FORM_COLLECTED.`,
    });
  }

  const submittedAt = new Date();

  const returnOffice = await prisma.collectionOffice.findUnique({
    where: { id: data.returnOfficeId },
  });

  if (!returnOffice) {
    throw createError({
      statusCode: 400,
      statusMessage: "Selected return office not found.",
    });
  }

  await prisma.$transaction([
    prisma.declaration.update({
      where: { id: data.declarationId },
      data: { status: "SUBMITTED", submittedAt, returnOfficeId: data.returnOfficeId },
    }),
    prisma.declarationStatusHistory.create({
      data: {
        declarationId: data.declarationId,
        status: "SUBMITTED",
        changedById: auth.userId,
        notes: data.notes
          ? `Form returned to ${returnOffice.name}: ${data.notes}`
          : `Form returned to ${returnOffice.name}; recorded by GAS officer`,
      },
    }),
  ]);

  // Log the action
  await logAction({
    userId: auth.userId,
    action: AuditActions.FORM_RETURNED,
    entityType: "declaration",
    entityId: declaration.id,
    oldValues: { status: "FORM_COLLECTED" },
    newValues: { status: "SUBMITTED", submittedAt },
    event,
  });

  // Send notification to applicant
  if (declaration.applicant.user) {
    await notifyDeclarationSubmitted(
      declaration.applicant.user.id,
      declaration.uniqueCode,
      declaration.applicant.fullName
    );
  }

  return {
    success: true,
    message: "Form return recorded successfully",
    data: {
      id: declaration.id,
      uniqueCode: declaration.uniqueCode,
      status: "SUBMITTED",
      submittedAt,
    },
  };
});
