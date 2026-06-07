import prisma from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const search = query.search as string | undefined;

  // Reference data that changes rarely. Cache per-URL (so each ?search= term
  // caches independently) and revalidate in the background.
  setResponseHeader(
    event,
    "Cache-Control",
    "public, max-age=60, stale-while-revalidate=300",
  );

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
