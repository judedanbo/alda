import { Prisma } from "@prisma/client";
import prisma from "~/server/utils/prisma";
import { resolveRange, num, requireAdmin } from "~/server/utils/analytics-query";

/**
 * Overview analytics — all metrics read from the pre-aggregated rollup tables
 * so the response stays fast regardless of raw traffic volume.
 */

interface SummaryRow {
  requests: bigint;
  errors: bigint;
  sum_duration: bigint;
  sum_bytes: bigint;
  unique_visitors: bigint;
  unique_sessions: bigint;
  new_visitors: bigint;
  weighted_p95: number | null;
}
interface TimeseriesRow {
  bucket: Date;
  visitor_class: string;
  requests: bigint;
  errors: bigint;
}
interface LabelCountRow {
  label: string | null;
  requests: bigint;
}
interface ClassRow {
  visitor_class: string;
  requests: bigint;
}

export default defineEventHandler(async (event) => {
  requireAdmin(event);
  const { range, since, table, grain } = resolveRange(getQuery(event).range);
  const tbl = Prisma.raw(table);

  const [summaryRows, timeseriesRows, topPages, topReferrers, byCountry, byDevice, byBrowser, classSplit]
    = await Promise.all([
      prisma.$queryRaw<SummaryRow[]>`
        SELECT
          COALESCE(SUM(requests), 0)::bigint AS requests,
          COALESCE(SUM(client_errors + server_errors), 0)::bigint AS errors,
          COALESCE(SUM(sum_duration_ms), 0)::bigint AS sum_duration,
          COALESCE(SUM(sum_bytes), 0)::bigint AS sum_bytes,
          COALESCE(SUM(unique_visitors), 0)::bigint AS unique_visitors,
          COALESCE(SUM(unique_sessions), 0)::bigint AS unique_sessions,
          COALESCE(SUM(new_visitors), 0)::bigint AS new_visitors,
          (SUM(p95_duration_ms::bigint * requests) / NULLIF(SUM(requests), 0))::float AS weighted_p95
        FROM ${tbl} WHERE bucket >= ${since}`,

      prisma.$queryRaw<TimeseriesRow[]>`
        SELECT bucket, visitor_class,
          SUM(requests)::bigint AS requests,
          SUM(client_errors + server_errors)::bigint AS errors
        FROM ${tbl} WHERE bucket >= ${since}
        GROUP BY bucket, visitor_class ORDER BY bucket ASC`,

      prisma.$queryRaw<LabelCountRow[]>`
        SELECT route_pattern AS label, SUM(requests)::bigint AS requests
        FROM ${tbl} WHERE bucket >= ${since}
        GROUP BY route_pattern ORDER BY 2 DESC LIMIT 10`,

      prisma.$queryRaw<LabelCountRow[]>`
        SELECT referrer_host AS label, SUM(requests)::bigint AS requests
        FROM ${tbl} WHERE bucket >= ${since} AND referrer_host <> '-'
        GROUP BY referrer_host ORDER BY 2 DESC LIMIT 10`,

      prisma.$queryRaw<LabelCountRow[]>`
        SELECT country AS label, SUM(requests)::bigint AS requests
        FROM ${tbl} WHERE bucket >= ${since} AND country <> '-'
        GROUP BY country ORDER BY 2 DESC LIMIT 12`,

      prisma.$queryRaw<LabelCountRow[]>`
        SELECT device_type AS label, SUM(requests)::bigint AS requests
        FROM ${tbl} WHERE bucket >= ${since} AND device_type <> '-'
        GROUP BY device_type ORDER BY 2 DESC`,

      prisma.$queryRaw<LabelCountRow[]>`
        SELECT browser AS label, SUM(requests)::bigint AS requests
        FROM ${tbl} WHERE bucket >= ${since} AND browser <> '-'
        GROUP BY browser ORDER BY 2 DESC LIMIT 8`,

      prisma.$queryRaw<ClassRow[]>`
        SELECT visitor_class, SUM(requests)::bigint AS requests
        FROM ${tbl} WHERE bucket >= ${since}
        GROUP BY visitor_class`,
    ]);

  const s = summaryRows[0];
  const totalRequests = num(s?.requests);
  const errors = num(s?.errors);

  // Pivot the time series into one requests array per visitor class.
  const buckets = [...new Set(timeseriesRows.map((r) => r.bucket.toISOString()))].sort();
  const classes = ["HUMAN", "SEARCH_BOT", "AI_AGENT", "OTHER_BOT"];
  const seriesByClass: Record<string, number[]> = {};
  for (const cls of classes) seriesByClass[cls] = buckets.map(() => 0);
  const errorSeries = buckets.map(() => 0);
  const bucketIndex = new Map(buckets.map((b, i) => [b, i]));
  for (const row of timeseriesRows) {
    const i = bucketIndex.get(row.bucket.toISOString());
    if (i === undefined) continue;
    if (seriesByClass[row.visitor_class]) seriesByClass[row.visitor_class]![i] += num(row.requests);
    errorSeries[i]! += num(row.errors);
  }

  return {
    success: true,
    data: {
      range,
      grain,
      summary: {
        totalRequests,
        errors,
        errorRate: totalRequests > 0 ? errors / totalRequests : 0,
        uniqueVisitors: num(s?.unique_visitors),
        uniqueSessions: num(s?.unique_sessions),
        newVisitors: num(s?.new_visitors),
        avgResponseMs: totalRequests > 0 ? Math.round(num(s?.sum_duration) / totalRequests) : 0,
        p95ResponseMs: Math.round(num(s?.weighted_p95)),
        totalBytes: num(s?.sum_bytes),
      },
      timeseries: {
        buckets,
        requestsByClass: seriesByClass,
        errors: errorSeries,
      },
      topPages: topPages.map((r) => ({ label: r.label ?? "-", requests: num(r.requests) })),
      topReferrers: topReferrers.map((r) => ({ label: r.label ?? "-", requests: num(r.requests) })),
      byCountry: byCountry.map((r) => ({ label: r.label ?? "-", requests: num(r.requests) })),
      byDevice: byDevice.map((r) => ({ label: r.label ?? "-", requests: num(r.requests) })),
      byBrowser: byBrowser.map((r) => ({ label: r.label ?? "-", requests: num(r.requests) })),
      visitorClassSplit: classSplit.map((r) => ({
        label: r.visitor_class,
        requests: num(r.requests),
      })),
    },
  };
});
