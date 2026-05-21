import prisma from "~/server/utils/prisma";
import { num, requireAdmin } from "~/server/utils/analytics-query";
import { trafficBufferDepth } from "~/server/utils/traffic-buffer";

/**
 * Realtime analytics — the last 30 minutes. This view intentionally reads the
 * raw `traffic_events` table (not the rollups): the window is tiny, bounded by
 * the `occurred_at` index, and rollups only refresh every few minutes.
 */

interface MinuteRow {
  minute: Date;
  requests: bigint;
}
interface CountRow {
  visitor_class: string;
  requests: bigint;
}

export default defineEventHandler(async (event) => {
  requireAdmin(event);
  const since = new Date(Date.now() - 30 * 60_000);

  const [perMinute, totals, classSplit, recent] = await Promise.all([
    prisma.$queryRaw<MinuteRow[]>`
      SELECT date_trunc('minute', occurred_at) AS minute, COUNT(*)::bigint AS requests
      FROM traffic_events WHERE occurred_at >= ${since}
      GROUP BY 1 ORDER BY 1 ASC`,

    prisma.$queryRaw<{ sessions: bigint; visitors: bigint; requests: bigint }[]>`
      SELECT
        COUNT(DISTINCT session_id)::bigint AS sessions,
        COUNT(DISTINCT visitor_id)::bigint AS visitors,
        COUNT(*)::bigint AS requests
      FROM traffic_events WHERE occurred_at >= ${since}`,

    prisma.$queryRaw<CountRow[]>`
      SELECT visitor_class, COUNT(*)::bigint AS requests
      FROM traffic_events WHERE occurred_at >= ${since}
      GROUP BY visitor_class`,

    prisma.trafficEvent.findMany({
      where: { occurredAt: { gte: since } },
      orderBy: { occurredAt: "desc" },
      take: 25,
      select: {
        occurredAt: true,
        method: true,
        path: true,
        statusCode: true,
        durationMs: true,
        visitorClass: true,
        aiProvider: true,
        ipTruncated: true,
        country: true,
      },
    }),
  ]);

  // Fill every minute in the window so the chart has no gaps.
  const buckets: string[] = [];
  const counts: number[] = [];
  const minuteMap = new Map(perMinute.map((r) => [r.minute.toISOString(), num(r.requests)]));
  const start = new Date(Math.floor(since.getTime() / 60_000) * 60_000);
  for (let t = start.getTime(); t <= Date.now(); t += 60_000) {
    const iso = new Date(t).toISOString();
    buckets.push(iso);
    counts.push(minuteMap.get(iso) ?? 0);
  }

  return {
    success: true,
    data: {
      windowMinutes: 30,
      activeSessions: num(totals[0]?.sessions),
      activeVisitors: num(totals[0]?.visitors),
      totalRequests: num(totals[0]?.requests),
      bufferDepth: trafficBufferDepth(),
      requestsByMinute: { buckets, counts },
      visitorClassSplit: classSplit.map((r) => ({ label: r.visitor_class, requests: num(r.requests) })),
      recentRequests: recent.map((r) => ({
        occurredAt: r.occurredAt.toISOString(),
        method: r.method,
        path: r.path,
        statusCode: r.statusCode,
        durationMs: r.durationMs,
        visitorClass: r.visitorClass,
        aiProvider: r.aiProvider,
        ipTruncated: r.ipTruncated,
        country: r.country,
      })),
    },
  };
});
