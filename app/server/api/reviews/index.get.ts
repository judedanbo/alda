import prisma from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;

  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  // Check if user is a schedule officer, legal unit, or admin
  const userRoles = await prisma.userRole.findMany({
    where: { userId: auth.userId },
    include: { role: true },
  });

  const allowedRoles = ["schedule_officer", "legal_unit", "admin"];
  const hasAccess = userRoles.some((ur) => allowedRoles.includes(ur.role.name));

  if (!hasAccess) {
    throw createError({
      statusCode: 403,
      statusMessage: "Access denied. Officer role required.",
    });
  }

  const query = getQuery(event);
  const limit = Math.min(Number(query.limit) || 20, 100);
  const offset = Number(query.offset) || 0;
  const status = query.status as string | undefined;
  const reviewerId = query.reviewerId as string | undefined;

  const where: Record<string, unknown> = {};

  if (status) {
    where.status = status;
  }

  if (reviewerId) {
    where.reviewedById = reviewerId;
  }

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
      include: {
        declaration: {
          include: {
            applicant: {
              include: {
                institution: true,
                officeCategory: true,
              },
            },
          },
        },
        reviewedBy: {
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
    prisma.review.count({ where }),
  ]);

  return {
    success: true,
    data: {
      reviews,
      total,
      limit,
      offset,
    },
  };
});
