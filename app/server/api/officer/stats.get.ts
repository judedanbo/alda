import prisma from "~/server/utils/prisma";

interface DailyBucket {
  date: string;
  codes: number;
  receipts: number;
}

interface QueueRow {
  pending_submissions: bigint;
  pending_reviews: bigint;
  pending_receipts: bigint;
  pending_pickups: bigint;
}

interface CodeWindowRow {
  codes_today: bigint;
  codes_week: bigint;
  codes_month: bigint;
}

interface FunnelRow {
  status: string;
  count: bigint;
}

interface ThroughputRow {
  bucket: Date;
  codes: bigint;
  receipts: bigint;
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const [queueRows, codeWindowRows, funnelRows, throughputRows] = await Promise.all([
    prisma.$queryRaw<QueueRow[]>`
      SELECT
        (SELECT COUNT(*) FROM declarations WHERE status = 'SUBMITTED') AS pending_submissions,
        (SELECT COUNT(*) FROM declarations WHERE status = 'UNDER_REVIEW') AS pending_reviews,
        (SELECT COUNT(*) FROM declarations d
          WHERE status = 'APPROVED'
            AND NOT EXISTS (SELECT 1 FROM receipts r WHERE r.declaration_id = d.id)) AS pending_receipts,
        (SELECT COUNT(*) FROM pickup_authorizations WHERE picked_up = false) AS pending_pickups
    `,
    prisma.$queryRaw<CodeWindowRow[]>`
      SELECT
        COUNT(*) FILTER (WHERE created_at >= date_trunc('day', now())) AS codes_today,
        COUNT(*) FILTER (WHERE created_at >= date_trunc('week', now())) AS codes_week,
        COUNT(*) FILTER (WHERE created_at >= date_trunc('month', now())) AS codes_month
      FROM declarations
    `,
    prisma.$queryRaw<FunnelRow[]>`
      SELECT status::text AS status, COUNT(*) AS count
      FROM declarations
      GROUP BY status
    `,
    prisma.$queryRaw<ThroughputRow[]>`
      WITH days AS (
        SELECT generate_series(
          date_trunc('day', now()) - interval '29 days',
          date_trunc('day', now()),
          interval '1 day'
        ) AS bucket
      )
      SELECT
        d.bucket,
        COALESCE((SELECT COUNT(*) FROM declarations WHERE date_trunc('day', created_at) = d.bucket), 0) AS codes,
        COALESCE((SELECT COUNT(*) FROM receipts WHERE date_trunc('day', created_at) = d.bucket), 0) AS receipts
      FROM days d
      ORDER BY d.bucket ASC
    `,
  ]);

  const queue = queueRows[0]!;
  const codeWindow = codeWindowRows[0]!;
  const statusOrder = ["PENDING", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "SEALED", "REJECTED"];
  const funnel = statusOrder.map((status) => ({
    status,
    count: Number(funnelRows.find((r) => r.status === status)?.count ?? 0),
  }));
  const throughput: DailyBucket[] = throughputRows.map((row) => ({
    date: row.bucket.toISOString().slice(0, 10),
    codes: Number(row.codes),
    receipts: Number(row.receipts),
  }));

  return {
    success: true,
    data: {
      queues: {
        pendingSubmissions: Number(queue.pending_submissions),
        pendingReviews: Number(queue.pending_reviews),
        pendingReceipts: Number(queue.pending_receipts),
        pendingPickups: Number(queue.pending_pickups),
      },
      codeWindows: {
        today: Number(codeWindow.codes_today),
        week: Number(codeWindow.codes_week),
        month: Number(codeWindow.codes_month),
      },
      funnel,
      throughput,
    },
  };
});
