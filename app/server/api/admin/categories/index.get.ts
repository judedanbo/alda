import prisma from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const includeInactive = query.includeInactive === "true";
  const where = includeInactive ? {} : { isActive: true };

  const categories = await prisma.publicOfficeCategory.findMany({
    where,
    orderBy: { name: "asc" },
  });

  return { success: true, data: categories };
});
