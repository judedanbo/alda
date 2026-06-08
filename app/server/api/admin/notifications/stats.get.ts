import prisma from "~/server/utils/prisma";

interface KpiRow {
  total_24h: bigint; delivered_24h: bigint; failed_24h: bigint; pending_24h: bigint;
  total_14d: bigint; delivered_14d: bigint; failed_14d: bigint; pending_14d: bigint;
}
interface ChannelRow {
  channel: string; total: bigint; delivered: bigint; failed: bigint; pending: bigint;
}
interface FailureTypeRow { type: string; failed: bigint }
interface TrendRow { bucket: Date; delivered: bigint; failed: bigint }

/** delivered / (delivered + failed), as a percentage; null when no terminal deliveries. */
function rate(delivered: number, failed: number): number | null {
  const terminal = delivered + failed;
  return terminal > 0 ? Math.round((delivered / terminal) * 1000) / 10 : null;
}

/**
 * Admin notification monitoring — Overview metrics. Reuses the stats.get.ts
 * aggregation pattern: prisma.$queryRaw + generate_series time-bucketing +
 * COUNT(*) FILTER conditional aggregates + bigint→Number conversion.
 */
export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }
  const userRoles = await prisma.userRole.findMany({
    where: { userId: auth.userId },
    include: { role: true },
  });
  if (!userRoles.some((ur) => ur.role.name === "admin")) {
    throw createError({ statusCode: 403, statusMessage: "Access denied. Admin role required." });
  }

  const [kpiRows, channelRows, failureRows, trendRows] = await Promise.all([
    prisma.$queryRaw<KpiRow[]>`
      SELECT
        COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours') AS total_24h,
        COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours' AND status = 'DELIVERED') AS delivered_24h,
        COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours' AND status = 'FAILED') AS failed_24h,
        COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours' AND status = 'PENDING') AS pending_24h,
        COUNT(*) FILTER (WHERE created_at >= now() - interval '14 days') AS total_14d,
        COUNT(*) FILTER (WHERE created_at >= now() - interval '14 days' AND status = 'DELIVERED') AS delivered_14d,
        COUNT(*) FILTER (WHERE created_at >= now() - interval '14 days' AND status = 'FAILED') AS failed_14d,
        COUNT(*) FILTER (WHERE created_at >= now() - interval '14 days' AND status = 'PENDING') AS pending_14d
      FROM notification_delivery_logs
    `,
    prisma.$queryRaw<ChannelRow[]>`
      SELECT channel::text AS channel,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'DELIVERED') AS delivered,
        COUNT(*) FILTER (WHERE status = 'FAILED') AS failed,
        COUNT(*) FILTER (WHERE status = 'PENDING') AS pending
      FROM notification_delivery_logs
      WHERE created_at >= now() - interval '14 days'
      GROUP BY channel
    `,
    prisma.$queryRaw<FailureTypeRow[]>`
      SELECT n.type::text AS type, COUNT(*) AS failed
      FROM notification_delivery_logs dl
      JOIN notifications n ON n.id = dl.notification_id
      WHERE dl.status = 'FAILED' AND dl.created_at >= now() - interval '14 days'
      GROUP BY n.type
      ORDER BY failed DESC
      LIMIT 8
    `,
    prisma.$queryRaw<TrendRow[]>`
      WITH days AS (
        SELECT generate_series(
          date_trunc('day', now()) - interval '13 days',
          date_trunc('day', now()),
          interval '1 day'
        ) AS bucket
      )
      SELECT d.bucket,
        COALESCE((SELECT COUNT(*) FROM notification_delivery_logs WHERE date_trunc('day', created_at) = d.bucket AND status = 'DELIVERED'), 0) AS delivered,
        COALESCE((SELECT COUNT(*) FROM notification_delivery_logs WHERE date_trunc('day', created_at) = d.bucket AND status = 'FAILED'), 0) AS failed
      FROM days d
      ORDER BY d.bucket ASC
    `,
  ]);

  const k = kpiRows[0]!;
  const d24 = Number(k.delivered_24h), f24 = Number(k.failed_24h);
  const d14 = Number(k.delivered_14d), f14 = Number(k.failed_14d);

  return {
    success: true,
    data: {
      kpis: {
        last24h: {
          total: Number(k.total_24h), delivered: d24, failed: f24,
          pending: Number(k.pending_24h), deliveryRate: rate(d24, f24),
        },
        last14d: {
          total: Number(k.total_14d), delivered: d14, failed: f14,
          pending: Number(k.pending_14d), deliveryRate: rate(d14, f14),
        },
      },
      byChannel: channelRows.map((r) => ({
        channel: r.channel,
        total: Number(r.total),
        delivered: Number(r.delivered),
        failed: Number(r.failed),
        pending: Number(r.pending),
      })),
      failuresByType: failureRows.map((r) => ({ type: r.type, failed: Number(r.failed) })),
      trend: trendRows.map((r) => ({
        date: r.bucket.toISOString().slice(0, 10),
        delivered: Number(r.delivered),
        failed: Number(r.failed),
      })),
    },
  };
});
