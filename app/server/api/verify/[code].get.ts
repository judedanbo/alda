import prisma from "~/server/utils/prisma";
import { logAction, AuditActions } from "~/server/utils/audit";
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

  // Check if user is legal unit, schedule officer, or admin
  const userRoles = await prisma.userRole.findMany({
    where: { userId: auth.userId },
    include: { role: true },
  });

  const allowedRoles = ["legal_unit", "schedule_officer", "admin"];
  const hasAccess = userRoles.some((ur) => allowedRoles.includes(ur.role.name));

  if (!hasAccess) {
    throw createError({
      statusCode: 403,
      statusMessage: "Access denied. Legal Unit or Officer role required.",
    });
  }

  const code = getRouterParam(event, "code");

  if (!code) {
    throw createError({
      statusCode: 400,
      statusMessage: "Unique code is required",
    });
  }

  // Find declaration by unique code
  const declaration = await prisma.declaration.findUnique({
    where: { uniqueCode: code },
    include: {
      applicant: {
        include: {
          offices: {
            include: {
              officeCategory: true,
              institution: true,
            },
            orderBy: { startDate: "desc" as const },
          },
          user: {
            select: {
              email: true,
              phone: true,
              emailVerified: true,
              createdAt: true,
            },
          },
        },
      },
      sectionReviews: {
        include: {
          reviewer: { select: { id: true, email: true } },
          resolvedBy: { select: { id: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      reviews: {
        include: {
          reviewer: {
            select: {
              id: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      receipts: { orderBy: { createdAt: "desc" }, take: 1 },
      statusHistory: {
        include: {
          changedBy: {
            select: {
              id: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!declaration) {
    // Log failed verification attempt
    await logAction({
      userId: auth.userId,
      action: AuditActions.CODE_VERIFICATION_FAILED,
      entityType: "declaration",
      entityId: null,
      newValues: { code, reason: "Code not found" },
      event,
    });

    throw createError({
      statusCode: 404,
      statusMessage: "Declaration not found. Invalid unique code.",
    });
  }

  // Log successful verification
  await logAction({
    userId: auth.userId,
    action: AuditActions.CODE_VERIFIED,
    entityType: "declaration",
    entityId: declaration.id,
    newValues: { code },
    event,
  });

  const [ghanaCardFrontUrl, ghanaCardBackUrl, alternateIdScanUrl, signedReceipts] = await Promise.all([
    presignStored(declaration.applicant.ghanaCardFrontUrl),
    presignStored(declaration.applicant.ghanaCardBackUrl),
    presignStored(declaration.applicant.alternateIdScanUrl),
    Promise.all(
      declaration.receipts.map(async (r) => ({
        ...r,
        pdfUrl: await presignStored(r.pdfUrl),
      })),
    ),
  ]);

  return {
    success: true,
    data: {
      declaration: {
        ...declaration,
        applicant: {
          ...decryptProfileIds(declaration.applicant),
          ghanaCardFrontUrl,
          ghanaCardBackUrl,
          alternateIdScanUrl,
        },
        receipts: signedReceipts,
      },
      verification: {
        verified: true,
        verifiedAt: new Date().toISOString(),
        verifiedBy: auth.userId,
      },
    },
  };
});
