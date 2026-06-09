import prisma from "~/server/utils/prisma";
import { resolveRange, num, requireAdmin } from "~/server/utils/analytics-query";

/**
 * Abuse analytics — suspicious/blocked actors, the abuse-event timeline,
 * enforcement history and the operator allow/block list. These tables are
 * low-volume, so they are queried directly.
 */

interface TimelineRow {
  bucket: Date;
  count: bigint;
}

export default defineEventHandler(async (event) => {
  requireAdmin(event);
  const { range, since, grain } = resolveRange(getQuery(event).range);

  const [
    total,
    bySeverity,
    byCategory,
    timeline,
    topOffenders,
    recentEvents,
    enforcementActions,
    accessRules,
    activeEnforcementCount,
  ] = await Promise.all([
    prisma.abuseEvent.count({ where: { detectedAt: { gte: since } } }),

    prisma.abuseEvent.groupBy({
      by: ["severity"],
      where: { detectedAt: { gte: since } },
      _count: { _all: true },
    }),

    prisma.abuseEvent.groupBy({
      by: ["category"],
      where: { detectedAt: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { category: "desc" } },
    }),

    prisma.$queryRaw<TimelineRow[]>`
      SELECT date_trunc(${grain}, detected_at) AS bucket, COUNT(*)::bigint AS count
      FROM abuse_events WHERE detected_at >= ${since}
      GROUP BY 1 ORDER BY 1 ASC`,

    prisma.abuseEvent.groupBy({
      by: ["actorKey", "ipTruncated"],
      where: { detectedAt: { gte: since } },
      _count: { _all: true },
      _max: { score: true, detectedAt: true },
      orderBy: { _count: { actorKey: "desc" } },
      take: 10,
    }),

    prisma.abuseEvent.findMany({
      where: { detectedAt: { gte: since } },
      orderBy: { detectedAt: "desc" },
      take: 25,
      select: {
        id: true,
        detectedAt: true,
        category: true,
        severity: true,
        score: true,
        ipTruncated: true,
        path: true,
        signals: true,
      },
    }),

    prisma.enforcementAction.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        id: true,
        type: true,
        actorKey: true,
        reason: true,
        appliedById: true,
        expiresAt: true,
        active: true,
        createdAt: true,
      },
    }),

    prisma.actorAccessRule.findMany({
      where: { active: true },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        actorType: true,
        actorValue: true,
        ruleType: true,
        reason: true,
        expiresAt: true,
        createdAt: true,
      },
    }),

    prisma.enforcementAction.count({
      where: { active: true, type: { in: ["BLOCK", "THROTTLE"] } },
    }),
  ]);

  return {
    success: true,
    data: {
      range,
      summary: {
        totalEvents: total,
        activeEnforcement: activeEnforcementCount,
        bySeverity: bySeverity.map((r) => ({ label: r.severity, count: r._count._all })),
      },
      byCategory: byCategory.map((r) => ({ label: r.category, count: r._count._all })),
      timeline: {
        buckets: timeline.map((r) => r.bucket.toISOString()),
        counts: timeline.map((r) => num(r.count)),
      },
      topOffenders: topOffenders.map((r) => ({
        ipTruncated: r.ipTruncated ?? "(hashed)",
        actorKey: r.actorKey.slice(0, 16),
        events: r._count._all,
        maxScore: r._max.score ?? 0,
        lastSeen: r._max.detectedAt?.toISOString() ?? null,
      })),
      recentEvents: recentEvents.map((r) => ({
        id: r.id,
        detectedAt: r.detectedAt.toISOString(),
        category: r.category,
        severity: r.severity,
        score: r.score,
        ipTruncated: r.ipTruncated,
        path: r.path,
        signals: r.signals,
      })),
      enforcementActions: enforcementActions.map((r) => ({
        id: r.id,
        type: r.type,
        actorKey: r.actorKey.slice(0, 16),
        reason: r.reason,
        source: r.appliedById ? "manual" : "system",
        expiresAt: r.expiresAt?.toISOString() ?? null,
        active: r.active,
        createdAt: r.createdAt.toISOString(),
      })),
      accessRules: accessRules.map((r) => ({
        id: r.id,
        actorType: r.actorType,
        actorValue: r.actorValue,
        ruleType: r.ruleType,
        reason: r.reason,
        expiresAt: r.expiresAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
    },
  };
});
