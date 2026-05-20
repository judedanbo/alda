import prisma from "~/server/utils/prisma";

interface WindowRow {
  verifications_today: bigint;
  verifications_week: bigint;
  verifications_month: bigint;
  failures_month: bigint;
}

interface DailyRow {
  bucket: Date;
  count: bigint;
}

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const [windowRows, dailyRows, recent] = await Promise.all([
    prisma.$queryRaw<WindowRow[]>`
      SELECT
        COUNT(*) FILTER (WHERE action = 'CODE_VERIFIED' AND created_at >= date_trunc('day', now())) AS verifications_today,
        COUNT(*) FILTER (WHERE action = 'CODE_VERIFIED' AND created_at >= date_trunc('week', now())) AS verifications_week,
        COUNT(*) FILTER (WHERE action = 'CODE_VERIFIED' AND created_at >= date_trunc('month', now())) AS verifications_month,
        COUNT(*) FILTER (WHERE action = 'CODE_VERIFICATION_FAILED' AND created_at >= date_trunc('month', now())) AS failures_month
      FROM audit_logs
    `,
    prisma.$queryRaw<DailyRow[]>`
      WITH days AS (
        SELECT generate_series(
          date_trunc('day', now()) - interval '29 days',
          date_trunc('day', now()),
          interval '1 day'
        ) AS bucket
      )
      SELECT
        d.bucket,
        COALESCE((
          SELECT COUNT(*) FROM audit_logs
          WHERE action = 'CODE_VERIFIED' AND date_trunc('day', created_at) = d.bucket
        ), 0) AS count
      FROM days d
      ORDER BY d.bucket ASC
    `,
    prisma.auditLog.findMany({
      where: { action: { in: ["CODE_VERIFIED", "CODE_VERIFICATION_FAILED"] } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        action: true,
        newValues: true,
        createdAt: true,
        user: { select: { email: true } },
      },
    }),
  ]);

  const win = windowRows[0]!;
  const daily = dailyRows.map((r) => ({
    date: r.bucket.toISOString().slice(0, 10),
    count: Number(r.count),
  }));

  const recentVerifications = recent.map((row) => {
    const values = (row.newValues ?? {}) as Record<string, unknown>;
    return {
      id: row.id,
      action: row.action,
      code: typeof values.code === "string" ? values.code : null,
      found: row.action === "CODE_VERIFIED",
      verifierEmail: row.user?.email ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  });

  return {
    success: true,
    data: {
      windows: {
        today: Number(win.verifications_today),
        week: Number(win.verifications_week),
        month: Number(win.verifications_month),
        failedThisMonth: Number(win.failures_month),
      },
      daily,
      recentVerifications,
    },
  };
});
