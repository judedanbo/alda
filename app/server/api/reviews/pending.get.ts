import prisma from "~/server/utils/prisma";

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

  const where: Record<string, unknown> = {
    status: "UNDER_REVIEW",
  };

  if (search) {
    where.OR = [
      { uniqueCode: { contains: search, mode: "insensitive" } },
      { applicant: { fullName: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [declarations, total] = await Promise.all([
    prisma.declaration.findMany({
      where,
      include: {
        applicant: {
          include: {
            institution: true,
            officeCategory: true,
            user: {
              select: {
                email: true,
                phone: true,
              },
            },
          },
        },
        submission: {
          include: {
            recordedBy: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { submittedAt: "asc" }, // FIFO
      take: limit,
      skip: offset,
    }),
    prisma.declaration.count({ where }),
  ]);

  return {
    success: true,
    data: {
      declarations,
      total,
      limit,
      offset,
    },
  };
});
