import prisma from "~/server/utils/prisma";
import { presignStored } from "~/server/services/storage.service";
import { decryptProfileIds } from "~/server/utils/pii-encryption";

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

  // Get user's applicant profile
  const profile = await prisma.applicantProfile.findUnique({
    where: { userId: auth.userId },
  });

  const declaration = await prisma.declaration.findUnique({
    where: { id },
    include: {
      applicant: {
        include: {
          user: {
            select: {
              email: true,
              phone: true,
            },
          },
          offices: {
            include: {
              officeCategory: true,
              institution: true,
            },
            orderBy: { startDate: "desc" as const },
          },
        },
      },
      sectionReviews: {
        include: {
          reviewer: { select: { email: true } },
          resolvedBy: { select: { email: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      reviews: {
        include: {
          reviewer: {
            select: {
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      receipts: {
        orderBy: { createdAt: "desc" },
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

  // Check authorization - applicant can only see their own declarations
  const isApplicant = auth.roles.includes("applicant");
  const isOwner = profile && declaration.applicantId === profile.id;
  const isStaff = auth.roles.some((r: string) =>
    ["schedule_officer", "legal_unit", "admin"].includes(r)
  );

  if (isApplicant && !isOwner && !isStaff) {
    throw createError({
      statusCode: 403,
      statusMessage: "Forbidden",
      message: "You can only view your own declarations",
    });
  }

  // Re-sign every receipt PDF key on the way out. The bucket is private,
  // so the raw `pdfUrl` column holds a key and needs a fresh presigned URL.
  const signedReceipts = await Promise.all(
    declaration.receipts.map(async (r) => ({
      ...r,
      pdfUrl: await presignStored(r.pdfUrl),
    })),
  );

  return {
    success: true,
    data: {
      ...declaration,
      applicant: decryptProfileIds(declaration.applicant),
      receipts: signedReceipts,
    },
  };
});
