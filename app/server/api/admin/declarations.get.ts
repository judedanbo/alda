import prisma from "~/server/utils/prisma";
import { hashPii, decryptProfileIds } from "~/server/utils/pii-encryption";
import { ID_NUMBER_PATTERNS } from "~/server/utils/validators";

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

  const isAdmin = userRoles.some((ur) => ur.role.name === "admin");

  if (!isAdmin) {
    throw createError({
      statusCode: 403,
      statusMessage: "Access denied. Admin role required.",
    });
  }

  const query = getQuery(event);
  const limit = Math.min(Number(query.limit) || 20, 100);
  const offset = Number(query.offset) || 0;
  const search = query.search as string | undefined;
  const status = query.status as string | undefined;
  const dateFrom = query.dateFrom as string | undefined;
  const dateTo = query.dateTo as string | undefined;

  const where: Record<string, unknown> = {};

  if (search) {
    // National-ID columns are encrypted (C-5); substring search isn't
    // possible. Exact-match hash lookup is added when the search term
    // looks like a canonical ID number.
    const idCandidate = search.trim().toUpperCase();
    const idMatches: Record<string, unknown>[] = [];
    if (ID_NUMBER_PATTERNS.GHANA_CARD.test(idCandidate)) {
      idMatches.push({ applicant: { ghanaCardNumberHash: hashPii(idCandidate) } });
    } else {
      for (const t of ["PASSPORT", "VOTER_ID", "DRIVERS_LICENSE", "NIA_RECEIPT"] as const) {
        if (ID_NUMBER_PATTERNS[t].test(idCandidate)) {
          idMatches.push({ applicant: { idType: t, alternateIdNumberHash: hashPii(idCandidate) } });
        }
      }
    }
    where.OR = [
      { uniqueCode: { contains: search, mode: "insensitive" } },
      { applicant: { fullName: { contains: search, mode: "insensitive" } } },
      ...idMatches,
    ];
  }

  if (status) {
    where.status = status;
  }

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) {
      (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      (where.createdAt as Record<string, unknown>).lte = toDate;
    }
  }

  const [declarations, total] = await Promise.all([
    prisma.declaration.findMany({
      where,
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
              },
            },
          },
        },
        formCollections: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            collectionOffice: true,
          },
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
          include: {
            reviewer: {
              select: { email: true },
            },
          },
        },
        receipts: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.declaration.count({ where }),
  ]);

  return {
    success: true,
    data: {
      declarations: declarations.map((d) => ({
        id: d.id,
        uniqueCode: d.uniqueCode,
        status: d.status,
        submittedAt: d.submittedAt?.toISOString() || null,
        createdAt: d.createdAt.toISOString(),
        applicant: (() => {
          const decrypted = decryptProfileIds(d.applicant);
          return {
            fullName: d.applicant.fullName,
            idType: d.applicant.idType,
            ghanaCardNumber: decrypted.ghanaCardNumber,
            alternateIdNumber: decrypted.alternateIdNumber,
            offices: d.applicant.offices,
            user: d.applicant.user,
          };
        })(),
        formCollection: d.formCollections[0]
          ? {
              collectedAt: d.formCollections[0].collectedAt.toISOString(),
              officeName: d.formCollections[0].collectionOffice.name,
              notes: d.formCollections[0].notes,
            }
          : null,
        formReissues: d.formReissueRequests.map((r) => ({
          id: r.id,
          status: r.status,
          createdAt: r.createdAt.toISOString(),
          reviewedAt: r.reviewedAt?.toISOString() || null,
          approverType: r.approverType,
          approverDetail: r.approverDetail,
          decisionReason: r.decisionReason,
        })),
        sectionReviews: d.sectionReviews,
        review: d.reviews[0]
          ? {
              status: d.reviews[0].status,
              reviewDate: d.reviews[0].reviewDate.toISOString(),
              rejectionReason: d.reviews[0].rejectionReason,
              reviewer: d.reviews[0].reviewer,
            }
          : null,
        receipt: d.receipts[0]
          ? {
              receiptNumber: d.receipts[0].receiptNumber,
              createdAt: d.receipts[0].createdAt.toISOString(),
            }
          : null,
      })),
      total,
      limit,
      offset,
    },
  };
});
