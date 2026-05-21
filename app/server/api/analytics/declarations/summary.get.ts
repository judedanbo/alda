import prisma from "~/server/utils/prisma";
import { getCached, buildCacheKey } from "~/server/utils/analytics-cache";
import {
  parseFilters,
  getRoleScope,
  buildSealedHistoryWhere,
  getComparisonDateRange,
} from "~/server/utils/analytics-filters";

interface SummaryData {
  totalSealed: number;
  avgProcessingDays: number;
  officesCovered: number;
  totalOffices: number;
  formReissueRate: number;
  rejectionRate: number;
  comparisons: {
    totalSealed: { previous: number; changePercent: number | null };
    avgProcessingDays: { previous: number; changePercent: number | null };
    rejectionRate: { previous: number; changePercent: number | null };
  };
}

async function computeAvgProcessingDays(
  where: Record<string, unknown>,
): Promise<number> {
  const rows = await prisma.$queryRaw<{ avg_days: number }[]>`
    SELECT COALESCE(AVG(
      EXTRACT(EPOCH FROM (sealed.created_at - created_entry.created_at)) / 86400.0
    ), 0) AS avg_days
    FROM declaration_status_history sealed
    JOIN (
      SELECT declaration_id, MIN(created_at) AS created_at
      FROM declaration_status_history
      WHERE status = 'CODE_GENERATED'
      GROUP BY declaration_id
    ) created_entry ON sealed.declaration_id = created_entry.declaration_id
    WHERE sealed.status = 'SEALED'
      AND (${where.dateFrom}::timestamptz IS NULL OR sealed.created_at >= ${where.dateFrom}::timestamptz)
      AND (${where.dateTo}::timestamptz IS NULL OR sealed.created_at <= ${where.dateTo}::timestamptz)
      AND (${where.changedById}::uuid IS NULL OR sealed.changed_by_id = ${where.changedById}::uuid)
  `;
  return Math.round((rows[0]?.avg_days ?? 0) * 10) / 10;
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const filters = parseFilters(event);
  const scope = await getRoleScope(event);
  const where = buildSealedHistoryWhere(filters, scope);

  const cacheKey = buildCacheKey("summary", {
    ...filters,
    role: scope.role,
    userId: scope.role === "admin" || scope.role === "legal_unit" ? undefined : scope.userId,
  });

  const data = await getCached<SummaryData>(cacheKey, 300, async () => {
    const [
      totalSealed,
      totalOffices,
      totalDeclarations,
      rejectedCount,
    ] = await Promise.all([
      prisma.declarationStatusHistory.count({ where }),
      prisma.institution.count({ where: { isActive: true } }),
      prisma.declaration.count(),
      prisma.declaration.count({ where: { status: "REJECTED" } }),
    ]);

    // Offices covered: distinct institutions with sealed declarations
    const sealedDeclarationIds = await prisma.declarationStatusHistory.findMany({
      where,
      select: { declarationId: true },
      distinct: ["declarationId"],
    });
    const declIds = sealedDeclarationIds.map((d) => d.declarationId);

    let officesCovered = 0;
    if (declIds.length > 0) {
      const offices = await prisma.applicantOffice.findMany({
        where: {
          profile: { declarations: { some: { id: { in: declIds } } } },
          institutionId: { not: null },
        },
        select: { institutionId: true },
        distinct: ["institutionId"],
      });
      officesCovered = offices.length;
    }

    // Form reissue rate
    let formReissueRate = 0;
    if (declIds.length > 0) {
      const reissueCount = await prisma.formReissueRequest.count({
        where: {
          declarationId: { in: declIds },
          status: "APPROVED",
        },
      });
      formReissueRate =
        totalSealed > 0
          ? Math.round((reissueCount / totalSealed) * 1000) / 10
          : 0;
    }

    const rejectionRate =
      totalDeclarations > 0
        ? Math.round((rejectedCount / totalDeclarations) * 1000) / 10
        : 0;

    const avgProcessingDays = await computeAvgProcessingDays({
      dateFrom: filters.dateFrom ?? null,
      dateTo: filters.dateTo ?? null,
      changedById:
        scope.role === "schedule_officer" ? scope.userId : null,
    });

    // Comparison period
    const compRange = getComparisonDateRange(filters.dateFrom, filters.dateTo);
    let comparisons: SummaryData["comparisons"] = {
      totalSealed: { previous: 0, changePercent: null },
      avgProcessingDays: { previous: 0, changePercent: null },
      rejectionRate: { previous: 0, changePercent: null },
    };

    if (compRange) {
      const prevWhere = { ...where };
      prevWhere.createdAt = { gte: compRange.prevFrom, lte: compRange.prevTo };

      const [prevSealed, prevRejected, prevTotal] = await Promise.all([
        prisma.declarationStatusHistory.count({ where: prevWhere }),
        prisma.declaration.count({
          where: {
            status: "REJECTED",
            createdAt: { gte: compRange.prevFrom, lte: compRange.prevTo },
          },
        }),
        prisma.declaration.count({
          where: {
            createdAt: { gte: compRange.prevFrom, lte: compRange.prevTo },
          },
        }),
      ]);

      const prevAvg = await computeAvgProcessingDays({
        dateFrom: compRange.prevFrom,
        dateTo: compRange.prevTo,
        changedById:
          scope.role === "schedule_officer" ? scope.userId : null,
      });

      const prevRejRate =
        prevTotal > 0
          ? Math.round((prevRejected / prevTotal) * 1000) / 10
          : 0;

      const pct = (curr: number, prev: number) =>
        prev > 0 ? Math.round(((curr - prev) / prev) * 1000) / 10 : null;

      comparisons = {
        totalSealed: {
          previous: prevSealed,
          changePercent: pct(totalSealed, prevSealed),
        },
        avgProcessingDays: {
          previous: prevAvg,
          changePercent: pct(avgProcessingDays, prevAvg),
        },
        rejectionRate: {
          previous: prevRejRate,
          changePercent: pct(rejectionRate, prevRejRate),
        },
      };
    }

    return {
      totalSealed,
      avgProcessingDays,
      officesCovered,
      totalOffices,
      formReissueRate,
      rejectionRate,
      comparisons,
    };
  });

  return { success: true, data };
});
