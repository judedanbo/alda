import prisma from "~/server/utils/prisma";

/**
 * List document templates (admin). Includes each template's latest version
 * number/date so the UI can show progress. Admin role is enforced by the
 * server auth middleware on `/api/admin/*`.
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const limit = Math.min(Number(query.limit) || 50, 100);
  const offset = Number(query.offset) || 0;
  const search = (query.search as string | undefined)?.trim();

  const where = search
    ? {
        OR: [
          { title: { contains: search, mode: "insensitive" as const } },
          { category: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [templates, total] = await Promise.all([
    prisma.documentTemplate.findMany({
      where,
      orderBy: [{ category: "asc" }, { title: "asc" }],
      skip: offset,
      take: limit,
      select: {
        id: true,
        key: true,
        title: true,
        category: true,
        updatedAt: true,
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
          select: { versionNumber: true, status: true, createdAt: true },
        },
        _count: { select: { versions: true } },
      },
    }),
    prisma.documentTemplate.count({ where }),
  ]);

  return {
    success: true,
    data: {
      templates: templates.map((t) => ({
        id: t.id,
        key: t.key,
        title: t.title,
        category: t.category,
        updatedAt: t.updatedAt,
        versionCount: t._count.versions,
        latestVersion: t.versions[0] ?? null,
      })),
      total,
    },
  };
});
