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
  const limit = Math.min(Number(query.limit) || 20, 100);
  const offset = Number(query.offset) || 0;
  const search = query.search as string | undefined;
  const status = query.status as string | undefined;

  const where: Record<string, unknown> = {};

  if (search) {
    where.name = { contains: search, mode: "insensitive" };
  }

  if (status === "active") {
    where.isActive = true;
  } else if (status === "inactive") {
    where.isActive = false;
  }

  const [institutions, total] = await Promise.all([
    prisma.institution.findMany({
      where,
      include: {
        _count: {
          select: { applicantOffices: true },
        },
      },
      orderBy: { name: "asc" },
      take: limit,
      skip: offset,
    }),
    prisma.institution.count({ where }),
  ]);

  return {
    success: true,
    data: {
      institutions,
      total,
      limit,
      offset,
    },
  };
});
