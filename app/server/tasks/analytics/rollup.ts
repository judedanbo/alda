import prisma from "~/server/utils/prisma";
import { getAnalyticsConfig } from "~/server/utils/analytics-config";
import {
  getAnalyticsStorage,
  StorageKeys,
  safeGet,
  safeSet,
} from "~/server/utils/analytics-storage";
import { refreshAiIpRanges } from "~/server/utils/ai-agents";

/**
 * Scheduled rollup task (`analytics:rollup`).
 *
 * Re-aggregates raw `traffic_events` into the hourly and daily rollup tables a
 * trailing window at a time. The window is deleted and re-inserted each run so
 * the task is idempotent and naturally absorbs late-arriving events. Dashboard
 * queries read only these rollups, never the raw table.
 *
 * Additive metrics (requests, errors, sums, new visitor/session counts) sum
 * exactly across buckets. `unique_visitors`/`unique_sessions` are per-bucket
 * distinct counts — summing them across buckets is the standard "uniques per
 * bucket" approximation; `p95_duration_ms` is exact per bucket.
 *
 * The published AI IP ranges are refreshed here too, throttled by the
 * configured interval, so no separate scheduled task is needed.
 */

function rollupSql(table: string, bucketExpr: string, windowExpr: string): { del: string; ins: string } {
  const del = `DELETE FROM ${table} WHERE bucket >= ${bucketExpr}`;
  const ins = `
    INSERT INTO ${table}
      (id, bucket, visitor_class, ai_provider, ai_category, country, route_pattern,
       requests, client_errors, server_errors, sum_duration_ms, max_duration_ms,
       p95_duration_ms, sum_bytes, unique_visitors, unique_sessions,
       new_visitors, new_sessions, created_at, updated_at)
    SELECT
      gen_random_uuid(),
      ${windowExpr},
      visitor_class,
      COALESCE(ai_provider, '-'),
      COALESCE(ai_category::text, '-'),
      COALESCE(country, '-'),
      route_pattern,
      COUNT(*)::int,
      COUNT(*) FILTER (WHERE status_code >= 400 AND status_code < 500)::int,
      COUNT(*) FILTER (WHERE status_code >= 500)::int,
      COALESCE(SUM(duration_ms), 0)::bigint,
      COALESCE(MAX(duration_ms), 0)::int,
      COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms), 0)::int,
      COALESCE(SUM(response_bytes), 0)::bigint,
      COUNT(DISTINCT visitor_id)::int,
      COUNT(DISTINCT session_id)::int,
      COUNT(*) FILTER (WHERE is_new_visitor)::int,
      COUNT(*) FILTER (WHERE is_new_session)::int,
      now(), now()
    FROM traffic_events
    WHERE occurred_at >= ${bucketExpr}
    GROUP BY 2, 3, 4, 5, 6, 7`;
  return { del, ins };
}

async function maybeRefreshAiRanges(): Promise<number> {
  const config = getAnalyticsConfig();
  if (!config.aiDetectionEnabled) return 0;
  const storage = getAnalyticsStorage();
  const key = StorageKeys.meta("ai-ranges-refreshed-at");
  const last = await safeGet<number>(storage, key);
  const dueMs = config.ai.ipRangeRefreshHours * 3600_000;
  if (last && Date.now() - last < dueMs) return 0;
  const count = await refreshAiIpRanges(storage);
  await safeSet(storage, key, Date.now());
  return count;
}

export default defineTask({
  meta: {
    name: "analytics:rollup",
    description: "Aggregate raw traffic events into hourly/daily rollups",
  },
  async run() {
    const config = getAnalyticsConfig();
    if (!config.enabled) {
      return { result: "skipped: analytics disabled" };
    }

    try {
      const hourly = rollupSql(
        "traffic_rollup_hourly",
        "date_trunc('hour', now()) - interval '3 hours'",
        "date_trunc('hour', occurred_at)",
      );
      const daily = rollupSql(
        "traffic_rollup_daily",
        "(date_trunc('day', now()) - interval '2 days')::date",
        "date_trunc('day', occurred_at)::date",
      );

      await prisma.$transaction([
        prisma.$executeRawUnsafe(hourly.del),
        prisma.$executeRawUnsafe(hourly.ins),
        prisma.$executeRawUnsafe(daily.del),
        prisma.$executeRawUnsafe(daily.ins),
      ]);

      const refreshed = await maybeRefreshAiRanges();
      return { result: `rollup complete (ai-ranges refreshed: ${refreshed})` };
    } catch (error) {
      console.error("[analytics:rollup] task failed:", error);
      return { result: "failed", error: String(error) };
    }
  },
});
