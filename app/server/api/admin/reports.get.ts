import { Prisma } from "@prisma/client";
import prisma from "~/server/utils/prisma";
import { getCached } from "~/server/utils/analytics-cache";

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
  const dateFrom = query.dateFrom as string | undefined;
  const dateTo = query.dateTo as string | undefined;

  const fromDate = dateFrom ? new Date(dateFrom) : undefined;
  let toDate: Date | undefined;
  if (dateTo) {
    toDate = new Date(dateTo);
    toDate.setHours(23, 59, 59, 999);
  }

  // Prisma `where` (createdAt range) for the groupBy queries.
  const dateFilter: Record<string, unknown> = {};
  if (fromDate || toDate) {
    dateFilter.createdAt = {
      ...(fromDate ? { gte: fromDate } : {}),
      ...(toDate ? { lte: toDate } : {}),
    };
  }

  // Reusable SQL date predicate (parameterized via Prisma.sql) for the raw
  // aggregate queries. `col` lets the same filter target d.created_at in joins.
  const dateConds = (col: Prisma.Sql) => {
    const conds: Prisma.Sql[] = [];
    if (fromDate) conds.push(Prisma.sql`${col} >= ${fromDate}`);
    if (toDate) conds.push(Prisma.sql`${col} <= ${toDate}`);
    return conds;
  };

  const data = await getCached(
    `admin:reports:${dateFrom ?? ""}:${dateTo ?? ""}`,
    300,
    async () => {
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

      // Monthly grouping pushed into SQL (date_trunc) — returns ~12 rows
      // instead of every declaration for the JS to bucket. Uses the new
      // declarations_created_at_idx.
      const monthWhere = Prisma.join(
        [Prisma.sql`created_at >= ${twelveMonthsAgo}`, ...dateConds(Prisma.sql`created_at`)],
        " AND ",
      );

      // Processing-time averages pushed into SQL. INNER lateral join on the
      // earliest review (metric requires a review); LEFT lateral join on the
      // earliest receipt (AVG ignores NULLs → only declarations with a receipt
      // count toward avg_review_to_receipt). Mirrors the old JS semantics.
      const procWhere = Prisma.join(
        [Prisma.sql`d.submitted_at IS NOT NULL`, ...dateConds(Prisma.sql`d.created_at`)],
        " AND ",
      );

      const [
        declarationsByStatus,
        usersByRole,
        roles,
        monthlyRows,
        topInstitutions,
        institutions,
        processingRows,
      ] = await Promise.all([
        prisma.declaration.groupBy({
          by: ["status"],
          _count: { status: true },
          where: dateFilter,
        }),
        prisma.userRole.groupBy({
          by: ["roleId"],
          _count: { roleId: true },
        }),
        prisma.role.findMany(),
        prisma.$queryRaw<{ month: string; count: number }[]>`
          SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
                 COUNT(*)::int AS count
          FROM declarations
          WHERE ${monthWhere}
          GROUP BY 1
          ORDER BY 1 ASC
        `,
        prisma.applicantOffice.groupBy({
          by: ["institutionId"],
          _count: { institutionId: true },
          where: { institutionId: { not: null } },
          orderBy: { _count: { institutionId: "desc" } },
          take: 10,
        }),
        prisma.institution.findMany({ select: { id: true, name: true } }),
        prisma.$queryRaw<
          { avg_submission_to_review: number | null; avg_review_to_receipt: number | null }[]
        >`
          SELECT
            AVG(EXTRACT(EPOCH FROM (r.created_at - d.submitted_at)) / 3600.0)::float8
              AS avg_submission_to_review,
            AVG(EXTRACT(EPOCH FROM (rc.created_at - r.created_at)) / 3600.0)::float8
              AS avg_review_to_receipt
          FROM declarations d
          JOIN LATERAL (
            SELECT created_at FROM reviews
            WHERE declaration_id = d.id ORDER BY created_at ASC LIMIT 1
          ) r ON true
          LEFT JOIN LATERAL (
            SELECT created_at FROM receipts
            WHERE declaration_id = d.id ORDER BY created_at ASC LIMIT 1
          ) rc ON true
          WHERE ${procWhere}
        `,
      ]);

      const roleMap = new Map(roles.map((r) => [r.id, r.name]));
      const institutionMap = new Map(institutions.map((i) => [i.id, i.name]));
      const proc = processingRows[0];

      return {
        declarationsByStatus: declarationsByStatus.map((d) => ({
          status: d.status,
          count: d._count.status,
        })),
        declarationsByMonth: monthlyRows.map((m) => ({
          month: m.month,
          count: m.count,
        })),
        usersByRole: usersByRole.map((u) => ({
          role: roleMap.get(u.roleId) || "Unknown",
          count: u._count.roleId,
        })),
        topInstitutions: topInstitutions.map((i) => ({
          name: institutionMap.get(i.institutionId!) || "Unknown",
          count: i._count.institutionId,
        })),
        processingTimes: {
          avgSubmissionToReview: Math.round(proc?.avg_submission_to_review ?? 0),
          avgReviewToReceipt: Math.round(proc?.avg_review_to_receipt ?? 0),
        },
      };
    },
  );

  return { success: true, data };
});
