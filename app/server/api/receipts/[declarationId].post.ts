import prisma from "~/server/utils/prisma";
import { logAction } from "~/server/utils/audit";
import { generateReceiptPDF, generateReceiptNumber } from "~/server/services/pdf.service";
import { sendNotification } from "~/server/services/notification.service";

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

  const declarationId = getRouterParam(event, "declarationId");

  if (!declarationId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Declaration ID is required",
    });
  }

  // Get the declaration with all related data
  const declaration = await prisma.declaration.findUnique({
    where: { id: declarationId },
    include: {
      applicant: {
        include: {
          user: true,
          institution: true,
          officeCategory: true,
        },
      },
      reviews: {
        include: {
          reviewer: true,
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!declaration) {
    throw createError({
      statusCode: 404,
      statusMessage: "Declaration not found",
    });
  }

  // Check if declaration is approved
  if (declaration.status !== "APPROVED") {
    throw createError({
      statusCode: 400,
      statusMessage: `Cannot generate receipt. Declaration status is ${declaration.status}, expected APPROVED.`,
    });
  }

  // Check if receipt already exists
  const existingReceipt = await prisma.receipt.findFirst({
    where: { declarationId },
  });

  if (existingReceipt) {
    throw createError({
      statusCode: 400,
      statusMessage: "Receipt already generated for this declaration",
      data: { receipt: existingReceipt },
    });
  }

  // Generate receipt number
  const receiptNumber = generateReceiptNumber();

  // Get reviewer info
  const review = declaration.reviews[0];
  const reviewer = review?.reviewer;

  // Generate PDF
  const pdfUrl = await generateReceiptPDF({
    receiptNumber,
    declarationCode: declaration.uniqueCode,
    applicantName: declaration.applicant.fullName,
    ghanaCardNumber: declaration.applicant.ghanaCardNumber,
    institution: declaration.applicant.institution?.name || "N/A",
    designation: declaration.applicant.designation,
    officeCategory: declaration.applicant.officeCategory?.name || "N/A",
    submissionDate: declaration.submittedAt || declaration.createdAt,
    approvalDate: review?.reviewDate || new Date(),
    approvedBy: reviewer?.email || "System",
    sealNumber: `SEAL-${Date.now()}`,
  });

  // Create receipt record and update declaration status
  const [receipt] = await prisma.$transaction([
    prisma.receipt.create({
      data: {
        declarationId,
        receiptNumber,
        generatedBy: auth.userId,
        pdfUrl,
      },
    }),
    prisma.declaration.update({
      where: { id: declarationId },
      data: { status: "SEALED" },
    }),
    prisma.declarationStatusHistory.create({
      data: {
        declarationId,
        status: "SEALED",
        changedById: auth.userId,
        notes: `Receipt generated: ${receiptNumber}`,
      },
    }),
  ]);

  // Log the action
  await logAction({
    userId: auth.userId,
    action: "RECEIPT_GENERATED",
    entityType: "receipt",
    entityId: receipt.id,
    newValues: { declarationId, receiptNumber, pdfUrl },
    event,
  });

  // Send notification to applicant
  if (declaration.applicant.user) {
    const user = declaration.applicant.user;

    await sendNotification({
      userId: user.id,
      type: "RECEIPT_READY",
      title: "Receipt Ready",
      message: `Your receipt (${receiptNumber}) for asset declaration ${declaration.uniqueCode} is ready. You will be notified when it's ready for pickup.`,
      metadata: {
        declarationId,
        receiptNumber,
        pdfUrl,
      },
    });
  }

  return {
    success: true,
    message: "Receipt generated successfully",
    data: {
      receipt: {
        ...receipt,
        pdfUrl,
      },
    },
  };
});
