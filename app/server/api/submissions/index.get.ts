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
  const status = query.status as string | undefined;
  const search = query.search as string | undefined;

  const where: Record<string, unknown> = {};

  if (status) {
    where.declaration = { status };
  }

  if (search) {
    where.OR = [
      { declaration: { uniqueCode: { contains: search, mode: "insensitive" } } },
      {
        declaration: {
          applicant: {
            fullName: { contains: search, mode: "insensitive" },
          },
        },
      },
    ];
  }

  const [submissions, total] = await Promise.all([
    prisma.submission.findMany({
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
        recordedBy: {
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
    prisma.submission.count({ where }),
  ]);

  return {
    success: true,
    data: {
      submissions,
      total,
      limit,
      offset,
    },
  };
});
