import prisma from "~/server/utils/prisma";
import { validateBody, reviewSchema } from "~/server/utils/validators";
import { logAction } from "~/server/utils/audit";
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

  const data = await validateBody(event, reviewSchema);

  // Get the declaration
  const declaration = await prisma.declaration.findUnique({
    where: { id: data.declarationId },
    include: {
      applicant: {
        include: {
          user: true,
          institution: true,
          officeCategory: true,
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
  if (declaration.status !== "UNDER_REVIEW") {
    throw createError({
      statusCode: 400,
      statusMessage: `Cannot review. Declaration status is ${declaration.status}, expected UNDER_REVIEW.`,
    });
  }

  // Check if review already exists
  const existingReview = await prisma.review.findFirst({
    where: { declarationId: data.declarationId },
  });

  if (existingReview) {
    throw createError({
      statusCode: 400,
      statusMessage: "Review already exists for this declaration",
    });
  }

  const isApproved = data.status === "APPROVED";
  const newStatus = isApproved ? "APPROVED" : "REJECTED";

  // Start transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create review
    const review = await tx.review.create({
      data: {
        declarationId: data.declarationId,
        reviewedById: auth.userId,
        reviewDate: new Date(),
        status: data.status,
        rejectionReason: data.rejectionReason,
      },
      include: {
        declaration: true,
        reviewedBy: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    // Update declaration status
    await tx.declaration.update({
      where: { id: data.declarationId },
      data: { status: newStatus },
    });

    // Add status history
    await tx.declarationStatusHistory.create({
      data: {
        declarationId: data.declarationId,
        status: newStatus,
        changedById: auth.userId,
        notes: isApproved
          ? "Declaration approved"
          : `Declaration rejected: ${data.rejectionReason}`,
      },
    });

    // If rejected, create a new unique code for resubmission
    let newCode: string | null = null;
    if (!isApproved) {
      newCode = await generateUniqueCode();

      // Create new declaration for resubmission
      await tx.declaration.create({
        data: {
          applicantId: declaration.applicantId,
          uniqueCode: newCode,
          status: "PENDING",
          previousDeclarationId: declaration.id,
        },
      });
    }

    return { review, newCode };
  });

  // Log the action
  await logAction({
    userId: auth.userId,
    action: isApproved ? "DECLARATION_APPROVED" : "DECLARATION_REJECTED",
    entityType: "review",
    entityId: result.review.id,
    newValues: {
      declarationId: data.declarationId,
      status: data.status,
      rejectionReason: data.rejectionReason,
    },
    event,
  });

  // Send notification to applicant
  if (declaration.applicant.user) {
    const user = declaration.applicant.user;

    if (isApproved) {
      await sendNotification({
        userId: user.id,
        type: "REVIEW_APPROVED",
        title: "Declaration Approved",
        message: `Your asset declaration (${declaration.uniqueCode}) has been approved. A receipt will be generated shortly.`,
        metadata: {
          declarationId: declaration.id,
          uniqueCode: declaration.uniqueCode,
        },
        channels: {
          email: {
            to: user.email,
            template: "declaration-status",
            data: {
              applicantName: declaration.applicant.fullName,
              uniqueCode: declaration.uniqueCode,
              status: "approved",
              statusMessage: "Your declaration has been approved.",
            },
          },
          sms: user.phone
            ? {
                to: user.phone,
                message: `ADLA: Your asset declaration (${declaration.uniqueCode}) has been approved. Please check your email for details.`,
              }
            : undefined,
        },
      });
    } else {
      await sendNotification({
        userId: user.id,
        type: "REVIEW_REJECTED",
        title: "Declaration Requires Revision",
        message: `Your asset declaration (${declaration.uniqueCode}) requires revision. Reason: ${data.rejectionReason}. A new code has been issued: ${result.newCode}`,
        metadata: {
          declarationId: declaration.id,
          uniqueCode: declaration.uniqueCode,
          newCode: result.newCode,
          rejectionReason: data.rejectionReason,
        },
        channels: {
          email: {
            to: user.email,
            template: "declaration-status",
            data: {
              applicantName: declaration.applicant.fullName,
              uniqueCode: declaration.uniqueCode,
              status: "rejected",
              statusMessage: `Your declaration requires revision.\n\nReason: ${data.rejectionReason}\n\nA new unique code has been issued: ${result.newCode}\n\nPlease use this new code to resubmit your declaration.`,
            },
          },
          sms: user.phone
            ? {
                to: user.phone,
                message: `ADLA: Your declaration (${declaration.uniqueCode}) requires revision. New code: ${result.newCode}. Check your email for details.`,
              }
            : undefined,
        },
      });
    }
  }

  return {
    success: true,
    message: isApproved
      ? "Declaration approved successfully"
      : "Declaration rejected. New code issued for resubmission.",
    data: {
      review: result.review,
      newCode: result.newCode,
    },
  };
});
