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

  const query = getQuery(event);
  const limit = Math.min(Number(query.limit) || 20, 100);
  const offset = Number(query.offset) || 0;
  const search = query.search as string | undefined;

  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { receiptNumber: { contains: search, mode: "insensitive" } },
      { declaration: { uniqueCode: { contains: search, mode: "insensitive" } } },
      {
        declaration: {
          applicant: { fullName: { contains: search, mode: "insensitive" } },
        },
      },
    ];
  }

  const [receipts, total] = await Promise.all([
    prisma.receipt.findMany({
      where,
      include: {
        declaration: {
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
              },
            },
          },
        },
        generator: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.receipt.count({ where }),
  ]);

  // Re-sign every receipt PDF + the nested applicant's ID scans for preview.
  const signedReceipts = await Promise.all(
    receipts.map(async (r) => {
      const applicant = r.declaration.applicant;
      const [pdfUrl, ghanaCardFrontUrl, ghanaCardBackUrl, alternateIdScanUrl] = await Promise.all([
        presignStored(r.pdfUrl),
        presignStored(applicant.ghanaCardFrontUrl),
        presignStored(applicant.ghanaCardBackUrl),
        presignStored(applicant.alternateIdScanUrl),
      ]);
      return {
        ...r,
        pdfUrl,
        declaration: {
          ...r.declaration,
          applicant: {
            ...applicant,
            ghanaCardFrontUrl,
            ghanaCardBackUrl,
            alternateIdScanUrl,
          },
        },
      };
    }),
  );

  return {
    success: true,
    data: {
      receipts: signedReceipts,
      total,
      limit,
      offset,
    },
  };
});
