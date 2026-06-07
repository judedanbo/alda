import prisma from "~/server/utils/prisma";
import { validateBody, approveReviewSchema } from "~/server/utils/validators";
import { logAction, AuditActions } from "~/server/utils/audit";
import { sendNotification } from "~/server/services/notification.service";
import { runAfterResponse } from "~/server/utils/after-response";
import { payloads } from "~/server/notifications/payloads";
import { assertOfficerCanActOnDeclaration } from "~/server/utils/officer-scope";

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

  // H-3: schedule officers can only approve declarations whose form was
  // collected at an office they're assigned to. Admins bypass.
  await assertOfficerCanActOnDeclaration(event, data.declarationId);

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
    runAfterResponse(sendNotification({
      userId: declaration.applicant.user.id,
      type: "REVIEW_APPROVED",
      ...payloads.declarationApproved({
        uniqueCode: declaration.uniqueCode,
        name: declaration.applicant.fullName,
        declarationId: declaration.id,
      }),
      dedupeKey: declaration.uniqueCode,
    }), "notify:REVIEW_APPROVED");
  }

  return {
    success: true,
    message: "Declaration approved successfully.",
    data: { review: result },
  };
});
