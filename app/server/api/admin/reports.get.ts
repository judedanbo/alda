import prisma from "~/server/utils/prisma";

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
  const dateFrom = query.dateFrom as string | undefined;
  const dateTo = query.dateTo as string | undefined;

  const dateFilter: Record<string, unknown> = {};
  if (dateFrom || dateTo) {
    dateFilter.createdAt = {};
    if (dateFrom) {
      (dateFilter.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      (dateFilter.createdAt as Record<string, unknown>).lte = toDate;
    }
  }

  // Declarations by status
  const declarationsByStatus = await prisma.declaration.groupBy({
    by: ["status"],
    _count: { status: true },
    where: dateFilter,
  });

  // Users by role
  const usersByRole = await prisma.userRole.groupBy({
    by: ["roleId"],
    _count: { roleId: true },
  });

  const roles = await prisma.role.findMany();
  const roleMap = new Map(roles.map((r) => [r.id, r.name]));

  // Declarations by month (last 12 months)
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const declarations = await prisma.declaration.findMany({
    where: {
      createdAt: { gte: twelveMonthsAgo },
      ...dateFilter,
    },
    select: { createdAt: true },
  });

  const monthlyData: Record<string, number> = {};
  declarations.forEach((d) => {
    const monthKey = d.createdAt.toISOString().substring(0, 7);
    monthlyData[monthKey] = (monthlyData[monthKey] || 0) + 1;
  });

  const declarationsByMonth = Object.entries(monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }));

  // Top institutions
  const topInstitutions = await prisma.applicantProfile.groupBy({
    by: ["institutionId"],
    _count: { institutionId: true },
    where: {
      institutionId: { not: null },
    },
    orderBy: { _count: { institutionId: "desc" } },
    take: 10,
  });

  const institutionIds = topInstitutions
    .map((i) => i.institutionId)
    .filter((id): id is string => id !== null);

  const institutions = await prisma.institution.findMany({
    where: { id: { in: institutionIds } },
  });

  const institutionMap = new Map(institutions.map((i) => [i.id, i.name]));

  // Processing times (average hours)
  const submissionsWithReviews = await prisma.submission.findMany({
    where: dateFilter,
    include: {
      declaration: {
        include: {
          reviews: { orderBy: { createdAt: "asc" }, take: 1 },
          receipts: { orderBy: { createdAt: "asc" }, take: 1 },
          pickupAuthorization: true,
        },
      },
    },
  });

  let totalSubmissionToReview = 0;
  let countSubmissionToReview = 0;
  let totalReviewToReceipt = 0;
  let countReviewToReceipt = 0;
  let totalReceiptToPickup = 0;
  let countReceiptToPickup = 0;

  submissionsWithReviews.forEach((submission) => {
    const review = submission.declaration.reviews[0];
    const receipt = submission.declaration.receipts[0];
    const pickup = submission.declaration.pickupAuthorization;

    if (review) {
      const hours =
        (review.createdAt.getTime() - submission.createdAt.getTime()) / (1000 * 60 * 60);
      totalSubmissionToReview += hours;
      countSubmissionToReview++;

      if (receipt) {
        const hours2 =
          (receipt.createdAt.getTime() - review.createdAt.getTime()) / (1000 * 60 * 60);
        totalReviewToReceipt += hours2;
        countReviewToReceipt++;

        if (pickup?.pickupDate) {
          const hours3 =
            (pickup.pickupDate.getTime() - receipt.createdAt.getTime()) / (1000 * 60 * 60);
          totalReceiptToPickup += hours3;
          countReceiptToPickup++;
        }
      }
    }
  });

  return {
    success: true,
    data: {
      declarationsByStatus: declarationsByStatus.map((d) => ({
        status: d.status,
        count: d._count.status,
      })),
      declarationsByMonth,
      usersByRole: usersByRole.map((u) => ({
        role: roleMap.get(u.roleId) || "Unknown",
        count: u._count.roleId,
      })),
      topInstitutions: topInstitutions.map((i) => ({
        name: institutionMap.get(i.institutionId!) || "Unknown",
        count: i._count.institutionId,
      })),
      processingTimes: {
        avgSubmissionToReview:
          countSubmissionToReview > 0
            ? Math.round(totalSubmissionToReview / countSubmissionToReview)
            : 0,
        avgReviewToReceipt:
          countReviewToReceipt > 0
            ? Math.round(totalReviewToReceipt / countReviewToReceipt)
            : 0,
        avgReceiptToPickup:
          countReceiptToPickup > 0
            ? Math.round(totalReceiptToPickup / countReceiptToPickup)
            : 0,
      },
    },
  };
});
