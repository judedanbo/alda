import prisma from "~/server/utils/prisma";
import { presignStored } from "~/server/services/storage.service";

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

  const declaration = await prisma.declaration.findUnique({
    where: { id },
    include: {
      applicant: {
        select: {
          userId: true,
          fullName: true,
        },
      },
      formCollections: {
        include: {
          collectionOffice: true,
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      formReissueRequests: {
        orderBy: { createdAt: "desc" },
      },
      sectionReviews: {
        include: {
          reviewer: { select: { email: true } },
          resolvedBy: { select: { email: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      receipts: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!declaration) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Declaration not found",
    });
  }

  // Check authorization
  const isOwner = declaration.applicant.userId === auth.userId;
  const isStaff = auth.roles.some((r: string) =>
    ["schedule_officer", "legal_unit", "admin"].includes(r)
  );

  if (!isOwner && !isStaff) {
    throw createError({
      statusCode: 403,
      statusMessage: "Forbidden",
    });
  }

  // Build timeline
  const timeline = [];

  timeline.push({
    status: "CREATED",
    date: declaration.createdAt,
    title: "Declaration Initiated",
    description: `Unique code ${declaration.uniqueCode} generated`,
  });

  const formCollection = declaration.formCollections[0];
  if (formCollection) {
    timeline.push({
      status: "FORM_COLLECTED",
      date: formCollection.collectedAt,
      title: "Form Collected",
      description: `Physical form collected from ${formCollection.collectionOffice.name}`,
    });
  }

  for (const reissue of declaration.formReissueRequests) {
    timeline.push({
      status: "FORM_REISSUE",
      date: reissue.createdAt,
      title: "Form Reissue Requested",
      description: "Applicant reported the collected form lost and requested a reissue",
    });
    if (reissue.reviewedAt && reissue.status !== "PENDING") {
      timeline.push({
        status: "FORM_REISSUE",
        date: reissue.reviewedAt,
        title:
          reissue.status === "APPROVED"
            ? "Form Reissue Approved"
            : "Form Reissue Declined",
        description:
          reissue.status === "APPROVED"
            ? "Approved by the Auditor General / Regional Auditor; form reissued"
            : `Declined: ${reissue.decisionReason ?? "no reason provided"}`,
      });
    }
  }

  if (declaration.submittedAt) {
    timeline.push({
      status: "SUBMITTED",
      date: declaration.submittedAt,
      title: "Declaration Submitted",
      description: "Form returned and submitted for review",
    });
  }

  const review = declaration.reviews[0];
  if (review) {
    timeline.push({
      status: review.status === "APPROVED" ? "APPROVED" : "REJECTED",
      date: review.reviewDate,
      title: review.status === "APPROVED" ? "Declaration Approved" : "Declaration Rejected",
      description: review.rejectionReason || "Review completed",
    });
  }

  const receipt = declaration.receipts[0];
  if (receipt) {
    timeline.push({
      status: "RECEIPT_READY",
      date: receipt.createdAt,
      title: "Receipt Ready",
      description: `Receipt number: ${receipt.receiptNumber}`,
    });
  }

  if (declaration.status === "SEALED") {
    timeline.push({
      status: "SEALED",
      date: declaration.updatedAt,
      title: "Declaration Sealed",
      description: "",
    });
  }

  return {
    success: true,
    data: {
      id: declaration.id,
      uniqueCode: declaration.uniqueCode,
      status: declaration.status,
      createdAt: declaration.createdAt,
      submittedAt: declaration.submittedAt,
      timeline: timeline.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      ),
      latestReview: declaration.reviews[0] || null,
      receipt: declaration.receipts[0]
        ? {
          ...declaration.receipts[0],
          pdfUrl: await presignStored(declaration.receipts[0]!.pdfUrl),
        }
        : null,
      sectionReviews: declaration.sectionReviews,
      hasPendingReissue: declaration.formReissueRequests.some(
        (r) => r.status === "PENDING"
      ),
    },
  };
});
