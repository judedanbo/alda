import prisma from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;

  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  const profile = await prisma.applicantProfile.findUnique({
    where: { userId: auth.userId },
    select: { id: true },
  });

  if (!profile) {
    return {
      success: true,
      data: { total: 0, pending: 0, approved: 0, rejected: 0 },
    };
  }

  const grouped = await prisma.declaration.groupBy({
    by: ["status"],
    where: { applicantId: profile.id },
    _count: { status: true },
  });

  const counts: Record<string, number> = {};
  for (const g of grouped) {
    counts[g.status] = g._count.status;
  }

  return {
    success: true,
    data: {
      total: Object.values(counts).reduce((a, b) => a + b, 0),
      pending: (counts["PENDING"] ?? 0) + (counts["SUBMITTED"] ?? 0) + (counts["UNDER_REVIEW"] ?? 0),
      approved: counts["APPROVED"] ?? 0,
      rejected: counts["REJECTED"] ?? 0,
    },
  };
});
