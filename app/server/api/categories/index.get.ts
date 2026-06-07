import prisma from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  // Reference data that changes rarely. Let browsers/CDNs serve it from cache
  // and revalidate in the background, so repeat views skip the DB entirely.
  setResponseHeader(
    event,
    "Cache-Control",
    "public, max-age=300, stale-while-revalidate=600",
  );

  const categories = await prisma.publicOfficeCategory.findMany({
    where: { isActive: true },
    orderBy: { id: "asc" },
  });

  return {
    success: true,
    data: categories,
  };
});
