import { Prisma } from "@prisma/client";
import prisma from "~/server/utils/prisma";
import { resolveRange, num, requireAdmin } from "~/server/utils/analytics-query";

/**
 * Fuzzing analytics — every classified probing attempt (malformed payloads,
 * probed URLs, suspicious paths, auth / param fuzzing). Unlike abuse events,
 * each attempt is recorded individually. The `fuzzing_attempts` table is
 * low/moderate volume, so it is queried directly rather than via rollups.
 */

interface TimelineRow {
  bucket: Date;
  count: bigint;
}

export default defineEventHandler(async (event) => {
  requireAdmin(event);
  const { range, since, grain } = resolveRange(getQuery(event).range);
  const truncExpr = Prisma.raw(grain === "hour" ? "hour" : "day");

  const [
    total,
    bySeverity,
    byCategory,
    timeline,
    topTargets,
    topOffenders,
    uniqueActorRows,
    highSeverityCount,
    recentAttempts,
  ] = await Promise.all([
    prisma.fuzzingAttempt.count({ where: { detectedAt: { gte: since } } }),

    prisma.fuzzingAttempt.groupBy({
      by: ["severity"],
      where: { detectedAt: { gte: since } },
      _count: { _all: true },
    }),

    prisma.fuzzingAttempt.groupBy({
      by: ["category"],
      where: { detectedAt: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { category: "desc" } },
    }),

    prisma.$queryRaw<TimelineRow[]>`
      SELECT date_trunc(${truncExpr}, detected_at) AS bucket, COUNT(*)::bigint AS count
      FROM fuzzing_attempts WHERE detected_at >= ${since}
      GROUP BY 1 ORDER BY 1 ASC`,

    prisma.fuzzingAttempt.groupBy({
      by: ["routePattern"],
      where: { detectedAt: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { routePattern: "desc" } },
      take: 10,
    }),

    prisma.fuzzingAttempt.groupBy({
      by: ["ipHash", "ipTruncated"],
      where: { detectedAt: { gte: since } },
      _count: { _all: true },
      _max: { detectedAt: true },
      orderBy: { _count: { ipHash: "desc" } },
      take: 10,
    }),

    prisma.fuzzingAttempt.findMany({
      where: { detectedAt: { gte: since } },
      distinct: ["ipHash"],
      select: { ipHash: true },
    }),

    prisma.fuzzingAttempt.count({
      where: { detectedAt: { gte: since }, severity: { in: ["HIGH", "CRITICAL"] } },
    }),

    prisma.fuzzingAttempt.findMany({
      where: { detectedAt: { gte: since } },
      orderBy: { detectedAt: "desc" },
      take: 25,
      select: {
        id: true,
        detectedAt: true,
        category: true,
        severity: true,
        method: true,
        path: true,
        statusCode: true,
        ipTruncated: true,
        country: true,
        details: true,
      },
    }),
  ]);

  return {
    success: true,
    data: {
      range,
      summary: {
        totalAttempts: total,
        uniqueActors: uniqueActorRows.length,
        highSeverity: highSeverityCount,
        bySeverity: bySeverity.map((r) => ({ label: r.severity, count: r._count._all })),
      },
      byCategory: byCategory.map((r) => ({ label: r.category, count: r._count._all })),
      timeline: {
        buckets: timeline.map((r) => r.bucket.toISOString()),
        counts: timeline.map((r) => num(r.count)),
      },
      topTargets: topTargets.map((r) => ({
        label: r.routePattern,
        count: r._count._all,
      })),
      topOffenders: topOffenders.map((r) => ({
        ipTruncated: r.ipTruncated ?? "(hashed)",
        actorKey: r.ipHash.slice(0, 16),
        attempts: r._count._all,
        lastSeen: r._max.detectedAt?.toISOString() ?? null,
      })),
      recentAttempts: recentAttempts.map((r) => ({
        id: r.id,
        detectedAt: r.detectedAt.toISOString(),
        category: r.category,
        severity: r.severity,
        method: r.method,
        path: r.path,
        statusCode: r.statusCode,
        ipTruncated: r.ipTruncated,
        country: r.country,
        details: r.details,
      })),
    },
  };
});
