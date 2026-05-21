import prisma from "~/server/utils/prisma";
import { logAction, AuditActions } from "~/server/utils/audit";

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

  const sectionReviewId = getRouterParam(event, "id");
  if (!sectionReviewId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Section review ID is required",
    });
  }

  const sectionReview = await prisma.declarationSectionReview.findUnique({
    where: { id: sectionReviewId },
    include: { declaration: true },
  });

  if (!sectionReview) {
    throw createError({
      statusCode: 404,
      statusMessage: "Section review not found",
    });
  }

  if (sectionReview.isAcceptable) {
    throw createError({
      statusCode: 400,
      statusMessage: "This section was already marked as acceptable",
    });
  }

  if (sectionReview.resolvedAt) {
    throw createError({
      statusCode: 400,
      statusMessage: "This section issue has already been resolved",
    });
  }

  const updated = await prisma.declarationSectionReview.update({
    where: { id: sectionReviewId },
    data: {
      resolvedAt: new Date(),
      resolvedById: auth.userId,
    },
  });

  await logAction({
    userId: auth.userId,
    action: AuditActions.SECTION_REVIEW_RESOLVED,
    entityType: "declarationSectionReview",
    entityId: sectionReviewId,
    oldValues: { resolvedAt: null },
    newValues: { resolvedAt: updated.resolvedAt, section: sectionReview.section },
    event,
  });

  const remainingIssues = await prisma.declarationSectionReview.count({
    where: {
      declarationId: sectionReview.declarationId,
      isAcceptable: false,
      resolvedAt: null,
    },
  });

  return {
    success: true,
    message: remainingIssues === 0
      ? "All section issues resolved. Declaration is ready for approval."
      : `Issue resolved. ${remainingIssues} issue(s) remaining.`,
    data: {
      sectionReview: updated,
      remainingIssues,
      readyForApproval: remainingIssues === 0,
    },
  };
});
