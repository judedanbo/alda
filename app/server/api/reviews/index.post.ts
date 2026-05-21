import prisma from "~/server/utils/prisma";
import { validateBody, sectionReviewSchema } from "~/server/utils/validators";
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

  const data = await validateBody(event, sectionReviewSchema);

  const declaration = await prisma.declaration.findUnique({
    where: { id: data.declarationId },
    include: {
      applicant: {
        include: {
          user: true,
          offices: {
            include: { officeCategory: true, institution: true },
            orderBy: { startDate: "desc" as const },
          },
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

  if (declaration.status !== "SUBMITTED") {
    throw createError({
      statusCode: 400,
      statusMessage: `Cannot review. Declaration status is ${declaration.status}, expected SUBMITTED.`,
    });
  }

  const allAcceptable = data.sections.every((s) => s.isAcceptable);

  if (allAcceptable) {
    const result = await prisma.$transaction(async (tx) => {
      await tx.declarationSectionReview.deleteMany({
        where: { declarationId: data.declarationId },
      });

      await tx.declarationSectionReview.createMany({
        data: data.sections.map((s) => ({
          declarationId: data.declarationId,
          reviewedBy: auth.userId,
          section: s.section,
          isAcceptable: true,
        })),
      });

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
          notes: "All form sections reviewed and approved",
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
      });
    }

    return {
      success: true,
      message: "All sections acceptable — declaration approved.",
      data: { approved: true },
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.declarationSectionReview.deleteMany({
      where: { declarationId: data.declarationId },
    });

    await tx.declarationSectionReview.createMany({
      data: data.sections.map((s) => ({
        declarationId: data.declarationId,
        reviewedBy: auth.userId,
        section: s.section,
        isAcceptable: s.isAcceptable,
        comments: s.isAcceptable ? null : s.comments,
      })),
    });

    await tx.declarationStatusHistory.create({
      data: {
        declarationId: data.declarationId,
        status: "SUBMITTED",
        changedById: auth.userId,
        notes: "Section review submitted — issues found in: " +
          data.sections
            .filter((s) => !s.isAcceptable)
            .map((s) => s.section)
            .join(", "),
      },
    });
  });

  await logAction({
    userId: auth.userId,
    action: AuditActions.SECTION_REVIEW_SUBMITTED,
    entityType: "declaration",
    entityId: data.declarationId,
    newValues: {
      sectionsWithIssues: data.sections
        .filter((s) => !s.isAcceptable)
        .map((s) => ({ section: s.section, comments: s.comments })),
    },
    event,
  });

  if (declaration.applicant.user) {
    const issueCount = data.sections.filter((s) => !s.isAcceptable).length;
    await sendNotification({
      userId: declaration.applicant.user.id,
      type: "SECTION_REVIEW_COMMENTS",
      title: "Declaration Review — Issues Found",
      message: `Your asset declaration (${declaration.uniqueCode}) has been reviewed. ${issueCount} section(s) require attention. Please visit your declaration page for details.`,
      metadata: {
        declarationId: declaration.id,
        uniqueCode: declaration.uniqueCode,
      },
    });
  }

  return {
    success: true,
    message: "Section review submitted. Issues flagged for applicant.",
    data: { approved: false },
  };
});
