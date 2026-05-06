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
    pickedUp: false,
  };

  if (search) {
    where.OR = [
      { authorizedName: { contains: search, mode: "insensitive" } },
      { declaration: { uniqueCode: { contains: search, mode: "insensitive" } } },
      {
        declaration: {
          applicant: { fullName: { contains: search, mode: "insensitive" } },
        },
      },
    ];
  }

  const [pickups, total] = await Promise.all([
    prisma.pickupAuthorization.findMany({
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
            receipts: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: limit,
      skip: offset,
    }),
    prisma.pickupAuthorization.count({ where }),
  ]);

  return {
    success: true,
    data: {
      pickups,
      total,
      limit,
      offset,
    },
  };
});
