import { Prisma } from "@prisma/client";
import prisma from "~/server/utils/prisma";
import { resolveRange, num, requireAdmin } from "~/server/utils/analytics-query";
import { getAnalyticsConfig } from "~/server/utils/analytics-config";

/**
 * Rate-limiting analytics — 429 volume, top throttled routes/actors and the
 * active rate-limit configuration. 429 counts come from the indexed raw
 * `traffic_events` table (`status_code` index); enforcement comes from the
 * `enforcement_actions` table.
 */

interface LabelCountRow {
  label: string | null;
  count: bigint;
}
interface BucketRow {
  bucket: Date;
  count: bigint;
}

export default defineEventHandler(async (event) => {
  requireAdmin(event);
  const { range, since, grain } = resolveRange(getQuery(event).range);
  const truncExpr = Prisma.raw(grain === "hour" ? "hour" : "day");
  const config = getAnalyticsConfig();

  const [total429, byRoute, byActor, timeline, throttleActions, activeThrottles, activeBlocks]
    = await Promise.all([
      prisma.trafficEvent.count({ where: { occurredAt: { gte: since }, statusCode: 429 } }),

      prisma.$queryRaw<LabelCountRow[]>`
        SELECT route_pattern AS label, COUNT(*)::bigint AS count
        FROM traffic_events WHERE occurred_at >= ${since} AND status_code = 429
        GROUP BY route_pattern ORDER BY 2 DESC LIMIT 10`,

      prisma.$queryRaw<LabelCountRow[]>`
        SELECT COALESCE(ip_truncated, '(hashed)') AS label, COUNT(*)::bigint AS count
        FROM traffic_events WHERE occurred_at >= ${since} AND status_code = 429
        GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,

      prisma.$queryRaw<BucketRow[]>`
        SELECT date_trunc(${truncExpr}, occurred_at) AS bucket, COUNT(*)::bigint AS count
        FROM traffic_events WHERE occurred_at >= ${since} AND status_code = 429
        GROUP BY 1 ORDER BY 1 ASC`,

      prisma.enforcementAction.findMany({
        where: { type: "THROTTLE" },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          actorKey: true,
          reason: true,
          appliedById: true,
          expiresAt: true,
          active: true,
          createdAt: true,
        },
      }),

      prisma.enforcementAction.count({ where: { active: true, type: "THROTTLE" } }),
      prisma.enforcementAction.count({ where: { active: true, type: "BLOCK" } }),
    ]);

  return {
    success: true,
    data: {
      range,
      summary: {
        total429,
        activeThrottles,
        activeBlocks,
      },
      config: {
        ipPerMin: config.rl.ipPerMin,
        authPerMin: config.rl.authPerMin,
        writePerMin: config.rl.writePerMin,
        uploadPer5Min: config.rl.uploadPer5Min,
        userPerMin: config.rl.userPerMin,
        abusiveMultiplier: config.rl.abusiveMultiplier,
        aiThrottleMultiplier: config.rl.aiThrottleMultiplier,
        enabled: config.rateLimitEnabled,
        storageDriver: config.storageDriver,
      },
      topThrottledRoutes: byRoute.map((r) => ({ label: r.label ?? "-", count: num(r.count) })),
      topThrottledActors: byActor.map((r) => ({ label: r.label ?? "-", count: num(r.count) })),
      timeline: {
        buckets: timeline.map((r) => r.bucket.toISOString()),
        counts: timeline.map((r) => num(r.count)),
      },
      throttleActions: throttleActions.map((r) => ({
        id: r.id,
        actorKey: r.actorKey.slice(0, 16),
        reason: r.reason,
        source: r.appliedById ? "manual" : "system",
        expiresAt: r.expiresAt?.toISOString() ?? null,
        active: r.active,
        createdAt: r.createdAt.toISOString(),
      })),
    },
  };
});
