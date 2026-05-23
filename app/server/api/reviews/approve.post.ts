import prisma from "~/server/utils/prisma";
import { validateBody, approveReviewSchema } from "~/server/utils/validators";
import { logAction, AuditActions } from "~/server/utils/audit";
import { sendNotification } from "~/server/services/notification.service";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;

  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

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

  const data = await validateBody(event, approveReviewSchema);

  const declaration = await prisma.declaration.findUnique({
    where: { id: data.declarationId },
    include: {
      applicant: { include: { user: true } },
      sectionReviews: {
        where: { isAcceptable: false, resolvedAt: null },
      },
    },
  });

  if (!declaration) {
    throw createError({
      statusCode: 404,
      statusMessage: "Declaration not found",
    });
  }

  if (declaration.status !== "UNDER_REVIEW") {
    throw createError({
      statusCode: 400,
      statusMessage: `Cannot approve. Declaration status is ${declaration.status}, expected UNDER_REVIEW.`,
    });
  }

  if (declaration.sectionReviews.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `Cannot approve. ${declaration.sectionReviews.length} section issue(s) are still unresolved.`,
    });
  }

  const result = await prisma.$transaction(async (tx) => {
    const review = await tx.review.create({
      data: {
        declarationId: data.declarationId,
        reviewedBy: auth.userId,
        reviewDate: new Date(),
        status: "APPROVED",
      },
    });

    await tx.declaration.update({
      where: { id: data.declarationId },
      data: { status: "APPROVED" },
    });

    await tx.declarationStatusHistory.create({
      data: {
        declarationId: data.declarationId,
        status: "APPROVED",
        changedById: auth.userId,
        notes: "Declaration approved after all section issues resolved",
      },
    });

    return review;
  });

  await logAction({
    userId: auth.userId,
    action: AuditActions.DECLARATION_APPROVED,
    entityType: "review",
    entityId: result.id,
    newValues: { declarationId: data.declarationId, status: "APPROVED" },
    event,
  });

  if (declaration.applicant.user) {
    await sendNotification({
      userId: declaration.applicant.user.id,
      type: "REVIEW_APPROVED",
      title: "Declaration Approved",
      message: `Your asset declaration (${declaration.uniqueCode}) has been approved. A receipt will be generated shortly.`,
      metadata: {
        declarationId: declaration.id,
        uniqueCode: declaration.uniqueCode,
      },
      dedupeKey: declaration.uniqueCode,
    });
  }

  return {
    success: true,
    message: "Declaration approved successfully.",
    data: { review: result },
  };
});
