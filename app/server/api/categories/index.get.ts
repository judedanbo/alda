import prisma from "~/server/utils/prisma";

export default defineEventHandler(async () => {
  const categories = await prisma.publicOfficeCategory.findMany({
    where: { isActive: true },
    orderBy: { id: "asc" },
  });

  return {
    success: true,
    data: categories,
  };
});
