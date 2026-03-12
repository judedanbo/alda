import prisma from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const search = query.search as string | undefined;

  const institutions = await prisma.institution.findMany({
    where: {
      isActive: true,
      ...(search
        ? {
            name: {
              contains: search,
              mode: "insensitive",
            },
          }
        : {}),
    },
    orderBy: { name: "asc" },
  });

  return {
    success: true,
    data: institutions,
  };
});
