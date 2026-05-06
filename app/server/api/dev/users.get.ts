import prisma from "~/server/utils/prisma";

export default defineEventHandler(async () => {
  if (process.env.NODE_ENV === "production") {
    throw createError({ statusCode: 404, statusMessage: "Not Found" });
  }

  const users = await prisma.user.findMany({
    where: {
      email: { endsWith: "@adla.gov.gh" },
    },
    select: {
      id: true,
      email: true,
      roles: {
        select: {
          role: {
            select: { name: true },
          },
        },
      },
    },
    orderBy: { email: "asc" },
  });

  return {
    success: true,
    data: users.map((u) => ({
      id: u.id,
      email: u.email,
      roles: u.roles.map((r) => r.role.name),
    })),
  };
});
