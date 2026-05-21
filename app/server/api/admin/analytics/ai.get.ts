import { Prisma } from "@prisma/client";
import prisma from "~/server/utils/prisma";
import { resolveRange, num, requireAdmin } from "~/server/utils/analytics-query";

/**
 * AI & bot analytics — AI vs human vs other-bot share, breakdown by provider
 * and category, top pages scraped by AI, and spoofed/cloaked/robots-violation
 * counts. Traffic shares read the rollups; abuse counts read `abuse_events`.
 */

interface LabelCountRow {
  label: string | null;
  requests: bigint;
}
interface TrendRow {
  bucket: Date;
  ai: bigint;
  total: bigint;
}

export default defineEventHandler(async (event) => {
  requireAdmin(event);
  const { range, since, table } = resolveRange(getQuery(event).range);
  const tbl = Prisma.raw(table);

  const [classSplit, byProvider, byCategory, topPages, trend, spoofed, cloaked, robots, recentVerified]
    = await Promise.all([
      prisma.$queryRaw<LabelCountRow[]>`
        SELECT visitor_class AS label, SUM(requests)::bigint AS requests
        FROM ${tbl} WHERE bucket >= ${since}
        GROUP BY visitor_class`,

      prisma.$queryRaw<LabelCountRow[]>`
        SELECT ai_provider AS label, SUM(requests)::bigint AS requests
        FROM ${tbl} WHERE bucket >= ${since} AND visitor_class = 'AI_AGENT' AND ai_provider <> '-'
        GROUP BY ai_provider ORDER BY 2 DESC`,

      prisma.$queryRaw<LabelCountRow[]>`
        SELECT ai_category AS label, SUM(requests)::bigint AS requests
        FROM ${tbl} WHERE bucket >= ${since} AND visitor_class = 'AI_AGENT' AND ai_category <> '-'
        GROUP BY ai_category ORDER BY 2 DESC`,

      prisma.$queryRaw<LabelCountRow[]>`
        SELECT route_pattern AS label, SUM(requests)::bigint AS requests
        FROM ${tbl} WHERE bucket >= ${since} AND visitor_class = 'AI_AGENT'
        GROUP BY route_pattern ORDER BY 2 DESC LIMIT 10`,

      prisma.$queryRaw<TrendRow[]>`
        SELECT bucket,
          SUM(requests) FILTER (WHERE visitor_class = 'AI_AGENT')::bigint AS ai,
          SUM(requests)::bigint AS total
        FROM ${tbl} WHERE bucket >= ${since}
        GROUP BY bucket ORDER BY bucket ASC`,

      prisma.abuseEvent.count({ where: { detectedAt: { gte: since }, category: "AI_SPOOFED" } }),
      prisma.abuseEvent.count({ where: { detectedAt: { gte: since }, category: "AI_CLOAKED" } }),
      prisma.abuseEvent.count({ where: { detectedAt: { gte: since }, category: "ROBOTS_VIOLATION" } }),

      prisma.$queryRaw<LabelCountRow[]>`
        SELECT ai_verified AS label, COUNT(*)::bigint AS requests
        FROM traffic_events
        WHERE occurred_at >= ${since} AND visitor_class = 'AI_AGENT' AND ai_verified IS NOT NULL
        GROUP BY ai_verified`,
    ]);

  const splitMap = new Map(classSplit.map((r) => [r.label ?? "-", num(r.requests)]));
  const aiTotal = splitMap.get("AI_AGENT") ?? 0;
  const grandTotal = [...splitMap.values()].reduce((a, b) => a + b, 0);

  return {
    success: true,
    data: {
      range,
      summary: {
        aiRequests: aiTotal,
        totalRequests: grandTotal,
        aiShare: grandTotal > 0 ? aiTotal / grandTotal : 0,
        spoofedCount: spoofed,
        cloakedCount: cloaked,
        robotsViolations: robots,
      },
      visitorClassSplit: ["HUMAN", "SEARCH_BOT", "AI_AGENT", "OTHER_BOT"].map((c) => ({
        label: c,
        requests: splitMap.get(c) ?? 0,
      })),
      byProvider: byProvider.map((r) => ({ label: r.label ?? "-", requests: num(r.requests) })),
      byCategory: byCategory.map((r) => ({ label: r.label ?? "-", requests: num(r.requests) })),
      topPages: topPages.map((r) => ({ label: r.label ?? "-", requests: num(r.requests) })),
      verification: recentVerified.map((r) => ({ label: r.label ?? "unknown", requests: num(r.requests) })),
      trend: {
        buckets: trend.map((r) => r.bucket.toISOString()),
        ai: trend.map((r) => num(r.ai)),
        total: trend.map((r) => num(r.total)),
      },
    },
  };
});
