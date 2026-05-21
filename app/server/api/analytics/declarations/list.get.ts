import prisma from "~/server/utils/prisma";
import {
  parseFilters,
  getRoleScope,
  buildSealedHistoryWhere,
} from "~/server/utils/analytics-filters";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const filters = parseFilters(event);
  const scope = await getRoleScope(event);
  const where = buildSealedHistoryWhere(filters, scope);

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  const sortableColumns: Record<string, string> = {
    sealedAt: "createdAt",
    code: "declaration.uniqueCode",
    applicant: "declaration.applicant.fullName",
  };
  const orderByField: string = sortableColumns[filters.sortBy ?? "sealedAt"] ?? "createdAt";
  const orderByDir = filters.sortOrder ?? "desc";

  const [total, rows] = await Promise.all([
    prisma.declarationStatusHistory.count({ where }),
    prisma.declarationStatusHistory.findMany({
      where,
      orderBy: { [orderByField.split(".")[0] as string]: orderByDir },
      skip,
      take: pageSize,
      select: {
        createdAt: true,
        changedBy: { select: { email: true } },
        declaration: {
          select: {
            id: true,
            uniqueCode: true,
            createdAt: true,
            applicant: {
              select: {
                fullName: true,
                ghanaCardNumber: true,
                offices: {
                  select: {
                    institution: { select: { name: true } },
                  },
                },
              },
            },
            formCollections: {
              take: 1,
              orderBy: { createdAt: "desc" },
              select: {
                collectionOffice: {
                  select: { name: true, region: true },
                },
              },
            },
            returnOffice: { select: { name: true, region: true } },
            receipts: {
              take: 1,
              select: { receiptNumber: true, pdfUrl: true },
            },
          },
        },
      },
    }),
  ]);

  const items = rows.map((row) => {
    const decl = row.declaration;
    const sealedAt = row.createdAt;
    const codeGeneratedAt = decl.createdAt;
    const processingDays =
      Math.round(
        ((sealedAt.getTime() - codeGeneratedAt.getTime()) / 86400000) * 10,
      ) / 10;

    const collectionOffice =
      decl.formCollections[0]?.collectionOffice ?? decl.returnOffice;

    const institutions = decl.applicant.offices
      .map((o) => o.institution?.name)
      .filter((n): n is string => !!n);
    const uniqueInstitutions = [...new Set(institutions)];

    const receipt = decl.receipts[0];

    return {
      id: decl.id,
      uniqueCode: decl.uniqueCode,
      applicantName: decl.applicant.fullName,
      ghanaCardNumber: decl.applicant.ghanaCardNumber,
      institutions: uniqueInstitutions,
      collectionOfficeName: collectionOffice?.name ?? null,
      collectionOfficeRegion: collectionOffice?.region ?? null,
      sealedAt: sealedAt.toISOString(),
      processingDays,
      processedBy: row.changedBy?.email?.split("@")[0] ?? "System",
      receiptNumber: receipt?.receiptNumber ?? null,
      receiptUrl: receipt?.pdfUrl ?? null,
    };
  });

  return {
    success: true,
    data: {
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    },
  };
});
