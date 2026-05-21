import prisma from "~/server/utils/prisma";
import { validateBody, rejectReviewSchema } from "~/server/utils/validators";
import { logAction, AuditActions } from "~/server/utils/audit";
import { sendNotification } from "~/server/services/notification.service";
import { generateUniqueCode } from "~/server/utils/code-generator";

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

  const data = await validateBody(event, rejectReviewSchema);

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

  if (declaration.status !== "SUBMITTED" && declaration.status !== "UNDER_REVIEW") {
    throw createError({
      statusCode: 400,
      statusMessage: `Cannot reject. Declaration status is ${declaration.status}, expected SUBMITTED or UNDER_REVIEW.`,
    });
  }

  const result = await prisma.$transaction(async (tx) => {
    const review = await tx.review.create({
      data: {
        declarationId: data.declarationId,
        reviewedBy: auth.userId,
        reviewDate: new Date(),
        status: "REJECTED",
        rejectionReason: data.rejectionReason,
      },
    });

    await tx.declaration.update({
      where: { id: data.declarationId },
      data: { status: "REJECTED" },
    });

    await tx.declarationStatusHistory.create({
      data: {
        declarationId: data.declarationId,
        status: "REJECTED",
        changedById: auth.userId,
        notes: `Declaration rejected: ${data.rejectionReason}`,
      },
    });

    let newCode: string | null = null;
    let newDeclarationStatus: string | null = null;
    if (data.reissueCode) {
      newCode = await generateUniqueCode();
      const newDeclaration = await tx.declaration.create({
        data: {
          applicantId: declaration.applicantId,
          uniqueCode: newCode,
          status: data.reissueStage,
          previousDeclarationId: declaration.id,
        },
      });
      newDeclarationStatus = data.reissueStage;

      await tx.declarationStatusHistory.create({
        data: {
          declarationId: newDeclaration.id,
          status: "CODE_GENERATED",
          changedById: auth.userId,
          notes: `Replacement declaration for rejected ${declaration.uniqueCode}`,
        },
      });

      if (data.reissueStage === "FORM_COLLECTED" && data.collectionOfficeId) {
        const office = await tx.collectionOffice.findUnique({
          where: { id: data.collectionOfficeId },
        });

        await tx.formCollection.create({
          data: {
            declarationId: newDeclaration.id,
            recordedBy: auth.userId,
            collectionOfficeId: data.collectionOfficeId,
            collectedAt: new Date(),
            notes: `Replacement form for rejected declaration ${declaration.uniqueCode}; recorded by ${auth.email}`,
          },
        });

        await tx.declarationStatusHistory.create({
          data: {
            declarationId: newDeclaration.id,
            status: "FORM_COLLECTED",
            changedById: auth.userId,
            notes: `Replacement form collected from ${office?.name ?? "office"}; recorded by ${auth.email}`,
          },
        });
      }
    }

    return { review, newCode, newDeclarationStatus };
  });

  await logAction({
    userId: auth.userId,
    action: AuditActions.DECLARATION_REJECTED,
    entityType: "review",
    entityId: result.review.id,
    newValues: {
      declarationId: data.declarationId,
      status: "REJECTED",
      rejectionReason: data.rejectionReason,
      reissueCode: data.reissueCode,
      ...(data.reissueCode ? { reissueStage: data.reissueStage } : {}),
      ...(data.collectionOfficeId ? { collectionOfficeId: data.collectionOfficeId } : {}),
    },
    event,
  });

  if (declaration.applicant.user) {
    const stageLabel = result.newDeclarationStatus === "FORM_COLLECTED"
      ? " Your replacement form is ready to be collected."
      : "";
    const message = result.newCode
      ? `Your asset declaration (${declaration.uniqueCode}) requires revision. Reason: ${data.rejectionReason}. A new code has been issued: ${result.newCode}.${stageLabel}`
      : `Your asset declaration (${declaration.uniqueCode}) has been rejected. Reason: ${data.rejectionReason}`;

    await sendNotification({
      userId: declaration.applicant.user.id,
      type: "REVIEW_REJECTED",
      title: result.newCode ? "Declaration Requires Revision" : "Declaration Rejected",
      message,
      metadata: {
        declarationId: declaration.id,
        uniqueCode: declaration.uniqueCode,
        ...(result.newCode ? { newCode: result.newCode } : {}),
        rejectionReason: data.rejectionReason,
      },
    });
  }

  return {
    success: true,
    message: result.newCode
      ? "Declaration rejected. New code issued for resubmission."
      : "Declaration rejected.",
    data: {
      review: result.review,
      newCode: result.newCode,
      newDeclarationStatus: result.newDeclarationStatus,
    },
  };
});
