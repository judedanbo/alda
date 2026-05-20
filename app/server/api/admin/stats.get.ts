import prisma from "~/server/utils/prisma";

interface CodeLifecycleRow {
  total_codes: bigint;
  active_codes: bigint;
  sealed_codes: bigint;
  regenerated_codes: bigint;
}

interface FunnelByMonthRow {
  bucket: Date;
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
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  // Check if user is an admin
  const userRoles = await prisma.userRole.findMany({
    where: { userId: auth.userId },
    include: { role: true },
  });

  const isAdmin = userRoles.some((ur) => ur.role.name === "admin");

  if (!isAdmin) {
    throw createError({
      statusCode: 403,
      statusMessage: "Access denied. Admin role required.",
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    totalUsers,
    totalApplicants,
    totalOfficers,
    totalDeclarations,
    pendingDeclarations,
    approvedDeclarations,
    rejectedDeclarations,
    todayDeclarations,
    recentUsers,
    recentDeclarations,
    recentAuditLogs,
    codeLifecycleRows,
    funnelByMonthRows,
    throughputRows,
    recentCodes,
  ] = await Promise.all([
    prisma.user.count(),

    prisma.userRole.count({
      where: { role: { name: "applicant" } },
    }),

    prisma.userRole.count({
      where: { role: { name: "schedule_officer" } },
    }),

    prisma.declaration.count(),

    prisma.declaration.count({
      where: {
        status: { in: ["CODE_GENERATED", "FORM_COLLECTED", "SUBMITTED", "UNDER_REVIEW"] },
      },
    }),

    prisma.declaration.count({
      where: { status: "APPROVED" },
    }),

    prisma.declaration.count({
      where: { status: "REJECTED" },
    }),

    prisma.declaration.count({
      where: { createdAt: { gte: today } },
    }),

    prisma.user.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        isActive: true,
        createdAt: true,
        roles: { include: { role: true } },
      },
    }),

    prisma.declaration.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        uniqueCode: true,
        status: true,
        createdAt: true,
        applicant: { select: { fullName: true } },
      },
    }),

    prisma.auditLog.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        action: true,
        entityType: true,
        ipAddress: true,
        createdAt: true,
        user: { select: { email: true } },
      },
    }),

    prisma.$queryRaw<CodeLifecycleRow[]>`
      SELECT
        COUNT(*) AS total_codes,
        COUNT(*) FILTER (WHERE status IN ('PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED')) AS active_codes,
        COUNT(*) FILTER (WHERE status = 'SEALED') AS sealed_codes,
        COUNT(*) FILTER (WHERE previous_declaration_id IS NOT NULL) AS regenerated_codes
      FROM declarations
    `,

    prisma.$queryRaw<FunnelByMonthRow[]>`
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', now()) - interval '5 months',
          date_trunc('month', now()),
          interval '1 month'
        ) AS bucket
      )
      SELECT
        m.bucket,
        d.status::text AS status,
        COUNT(d.id) AS count
      FROM months m
      LEFT JOIN declarations d
        ON date_trunc('month', d.created_at) = m.bucket
      GROUP BY m.bucket, d.status
      ORDER BY m.bucket ASC
    `,

    prisma.$queryRaw<ThroughputRow[]>`
      WITH days AS (
        SELECT generate_series(
          date_trunc('day', now()) - interval '89 days',
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

    prisma.declaration.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        uniqueCode: true,
        status: true,
        createdAt: true,
        previousDeclarationId: true,
        applicant: { select: { fullName: true } },
      },
    }),
  ]);

  const lifecycle = codeLifecycleRows[0]!;

  const monthBuckets = new Map<string, Record<string, number>>();
  for (const row of funnelByMonthRows) {
    const key = row.bucket.toISOString().slice(0, 7);
    if (!monthBuckets.has(key)) monthBuckets.set(key, {});
    if (row.status) {
      monthBuckets.get(key)![row.status] = Number(row.count);
    }
  }
  const funnelByMonth = Array.from(monthBuckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, statuses]) => ({ month, statuses }));

  const throughput = throughputRows.map((row) => ({
    date: row.bucket.toISOString().slice(0, 10),
    codes: Number(row.codes),
    receipts: Number(row.receipts),
  }));

  // Verification counts for recent codes
  const recentCodeIds = recentCodes.map((c) => c.id);
  const verificationCounts = recentCodeIds.length
    ? await prisma.auditLog.groupBy({
      by: ["entityId"],
      where: {
        action: "CODE_VERIFIED",
        entityType: "declaration",
        entityId: { in: recentCodeIds },
      },
      _count: { entityId: true },
    })
    : [];
  const verifyCountMap = new Map<string, number>(
    verificationCounts.map((v) => [v.entityId!, v._count.entityId]),
  );

  return {
    success: true,
    data: {
      stats: {
        totalUsers,
        totalApplicants,
        totalOfficers,
        totalDeclarations,
        pendingDeclarations,
        approvedDeclarations,
        rejectedDeclarations,
        todayDeclarations,
      },
      codeLifecycle: {
        total: Number(lifecycle.total_codes),
        active: Number(lifecycle.active_codes),
        sealed: Number(lifecycle.sealed_codes),
        regenerated: Number(lifecycle.regenerated_codes),
      },
      funnelByMonth,
      throughput,
      recentUsers: recentUsers.map((user) => ({
        id: user.id,
        email: user.email,
        roles: user.roles.map((r) => r.role.name),
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
      })),
      recentDeclarations: recentDeclarations.map((d) => ({
        id: d.id,
        uniqueCode: d.uniqueCode,
        status: d.status,
        applicantName: d.applicant.fullName,
        createdAt: d.createdAt.toISOString(),
      })),
      recentCodes: recentCodes.map((d) => ({
        id: d.id,
        uniqueCode: d.uniqueCode,
        status: d.status,
        applicantName: d.applicant.fullName,
        createdAt: d.createdAt.toISOString(),
        isRegenerated: !!d.previousDeclarationId,
        verificationCount: verifyCountMap.get(d.id) ?? 0,
      })),
      recentAuditLogs: recentAuditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        userEmail: log.user?.email || null,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt.toISOString(),
      })),
    },
  };
});
