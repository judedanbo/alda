import prisma from "~/server/utils/prisma";
import { getCached, buildCacheKey } from "~/server/utils/analytics-cache";
import {
  parseFilters,
  getRoleScope,
  buildSealedHistoryWhere,
} from "~/server/utils/analytics-filters";

interface TimelinePoint {
  month: string;
  count: number;
  prevCount: number;
}

interface InstitutionEntry {
  name: string;
  count: number;
}

interface CollectionOfficeData {
  byType: { type: string; count: number }[];
  byRegion: { region: string; count: number }[];
}

interface OfficerEntry {
  name: string;
  count: number;
  avgDays: number;
}

interface ChartsData {
  timeline: TimelinePoint[];
  byInstitution: InstitutionEntry[];
  byCollectionOffice: CollectionOfficeData;
  officerPerformance: OfficerEntry[];
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const filters = parseFilters(event);
  const scope = await getRoleScope(event);
  const where = buildSealedHistoryWhere(filters, scope);

  const cacheKey = buildCacheKey("charts", {
    ...filters,
    role: scope.role,
    userId: scope.role === "admin" || scope.role === "legal_unit" ? undefined : scope.userId,
  });

  const data = await getCached<ChartsData>(cacheKey, 300, async () => {
    // Wave 1: every query that doesn't depend on the sealed declaration IDs
    // runs concurrently (timeline, previous-period timeline, the sealed-id
    // lookup itself, and officer performance).
    const [timelineRows, prevTimelineRows, sealedDeclIds, officerRows] = await Promise.all([
      prisma.$queryRaw<{ bucket: Date; count: bigint }[]>`
        WITH months AS (
          SELECT generate_series(
            date_trunc('month', now()) - interval '11 months',
            date_trunc('month', now()),
            interval '1 month'
          ) AS bucket
        )
        SELECT m.bucket, COUNT(dsh.id) AS count
        FROM months m
        LEFT JOIN declaration_status_history dsh
          ON dsh.status = 'SEALED'
          AND date_trunc('month', dsh.created_at) = m.bucket
        GROUP BY m.bucket
        ORDER BY m.bucket ASC
      `,
      prisma.$queryRaw<{ bucket: Date; count: bigint }[]>`
        WITH months AS (
          SELECT generate_series(
            date_trunc('month', now()) - interval '23 months',
            date_trunc('month', now()) - interval '12 months',
            interval '1 month'
          ) AS bucket
        )
        SELECT m.bucket, COUNT(dsh.id) AS count
        FROM months m
        LEFT JOIN declaration_status_history dsh
          ON dsh.status = 'SEALED'
          AND date_trunc('month', dsh.created_at) = m.bucket
        GROUP BY m.bucket
        ORDER BY m.bucket ASC
      `,
      prisma.declarationStatusHistory.findMany({
        where,
        select: { declarationId: true },
        distinct: ["declarationId"],
      }),
      prisma.$queryRaw<
        { user_id: string; email: string; count: bigint; avg_days: number }[]
      >`
        SELECT
          u.id AS user_id,
          u.email,
          COUNT(sealed.id) AS count,
          COALESCE(AVG(
            EXTRACT(EPOCH FROM (sealed.created_at - created_entry.created_at)) / 86400.0
          ), 0) AS avg_days
        FROM declaration_status_history sealed
        JOIN users u ON sealed.changed_by_id = u.id
        JOIN (
          SELECT declaration_id, MIN(created_at) AS created_at
          FROM declaration_status_history
          WHERE status = 'CODE_GENERATED'
          GROUP BY declaration_id
        ) created_entry ON sealed.declaration_id = created_entry.declaration_id
        WHERE sealed.status = 'SEALED'
          AND sealed.changed_by_id IS NOT NULL
        GROUP BY u.id, u.email
        ORDER BY count DESC
        LIMIT 10
      `,
    ]);

    const timeline: TimelinePoint[] = timelineRows.map((row, i) => ({
      month: row.bucket.toISOString().slice(0, 7),
      count: Number(row.count),
      prevCount: Number(prevTimelineRows[i]?.count ?? 0),
    }));

    const officerPerformance: OfficerEntry[] = officerRows.map((r) => ({
      name: r.email.split("@")[0] ?? r.email,
      count: Number(r.count),
      avgDays: Math.round(r.avg_days * 10) / 10,
    }));

    const declIds = sealedDeclIds.map((d) => d.declarationId);

    // Wave 2: the two charts that filter by the sealed declaration IDs are
    // independent of each other, so compute them concurrently.
    const [byInstitution, byCollectionOffice] = await Promise.all([
      computeByInstitution(declIds),
      computeByCollectionOffice(declIds),
    ]);

    return { timeline, byInstitution, byCollectionOffice, officerPerformance };
  });

  return { success: true, data };
});

// Top 10 institutions among the sealed declarations.
async function computeByInstitution(declIds: string[]): Promise<InstitutionEntry[]> {
  if (declIds.length === 0) return [];

  const instGroups = await prisma.applicantOffice.groupBy({
    by: ["institutionId"],
    where: {
      profile: { declarations: { some: { id: { in: declIds } } } },
      institutionId: { not: null },
    },
    _count: { institutionId: true },
    orderBy: { _count: { institutionId: "desc" } },
    take: 10,
  });

  const instIds = instGroups
    .map((g) => g.institutionId)
    .filter((id): id is string => id !== null);
  const institutions = await prisma.institution.findMany({
    where: { id: { in: instIds } },
    select: { id: true, name: true },
  });
  const nameMap = new Map(institutions.map((i) => [i.id, i.name]));

  return instGroups.map((g) => ({
    name: nameMap.get(g.institutionId!) || "Unknown",
    count: g._count.institutionId,
  }));
}

// Collection-office breakdown (by type and by region) for the sealed declarations.
async function computeByCollectionOffice(declIds: string[]): Promise<CollectionOfficeData> {
  if (declIds.length === 0) return { byType: [], byRegion: [] };

  const collections = await prisma.formCollection.findMany({
    where: { declarationId: { in: declIds } },
    select: {
      collectionOffice: {
        select: { type: true, region: true },
      },
    },
  });

  const typeCounts = new Map<string, number>();
  const regionCounts = new Map<string, number>();

  for (const c of collections) {
    const t = c.collectionOffice.type;
    typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
    const r = c.collectionOffice.region ?? "Headquarters";
    regionCounts.set(r, (regionCounts.get(r) ?? 0) + 1);
  }

  return {
    byType: Array.from(typeCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
    byRegion: Array.from(regionCounts.entries())
      .map(([region, count]) => ({ region, count }))
      .sort((a, b) => b.count - a.count),
  };
}
