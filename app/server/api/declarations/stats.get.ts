import prisma from "~/server/utils/prisma";

interface TimelineRow {
  bucket: Date;
  count: bigint;
}

const ACTIVE_STATUSES = ["CODE_GENERATED", "FORM_COLLECTED", "SUBMITTED", "UNDER_REVIEW"] as const;

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;

  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  const profile = await prisma.applicantProfile.findUnique({
    where: { userId: auth.userId },
    select: { id: true },
  });

  if (!profile) {
    return {
      success: true,
      data: {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        activeDeclaration: null,
        codeHistory: [],
        verificationCount: 0,
        timeline: [],
      },
    };
  }

  const declarationIds = (
    await prisma.declaration.findMany({
      where: { applicantId: profile.id },
      select: { id: true },
    })
  ).map((d) => d.id);

  const [grouped, activeDeclaration, codeHistory, verificationCount, timelineRows] = await Promise.all([
    prisma.declaration.groupBy({
      by: ["status"],
      where: { applicantId: profile.id },
      _count: { status: true },
    }),
    prisma.declaration.findFirst({
      where: {
        applicantId: profile.id,
        status: { in: [...ACTIVE_STATUSES] },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        uniqueCode: true,
        status: true,
        createdAt: true,
        submittedAt: true,
        sectionReviews: {
          where: { isAcceptable: false, resolvedAt: null },
          select: { id: true },
        },
      },
    }),
    prisma.declaration.findMany({
      where: { applicantId: profile.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        uniqueCode: true,
        status: true,
        createdAt: true,
      },
    }),
    declarationIds.length
      ? prisma.auditLog.count({
        where: {
          action: "CODE_VERIFIED",
          entityType: "declaration",
          entityId: { in: declarationIds },
        },
      })
      : Promise.resolve(0),
    prisma.$queryRaw<TimelineRow[]>`
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', now()) - interval '11 months',
          date_trunc('month', now()),
          interval '1 month'
        ) AS bucket
      )
      SELECT
        m.bucket,
        COALESCE((
          SELECT COUNT(*) FROM declarations
          WHERE applicant_id = ${profile.id}::uuid
            AND date_trunc('month', created_at) = m.bucket
        ), 0) AS count
      FROM months m
      ORDER BY m.bucket ASC
    `,
  ]);

  const counts: Record<string, number> = {};
  for (const g of grouped) {
    counts[g.status] = g._count.status;
  }

  const timeline = timelineRows.map((row) => ({
    month: row.bucket.toISOString().slice(0, 7),
    count: Number(row.count),
  }));

  return {
    success: true,
    data: {
      total: Object.values(counts).reduce((a, b) => a + b, 0),
      pending: (counts["CODE_GENERATED"] ?? 0) + (counts["FORM_COLLECTED"] ?? 0) + (counts["SUBMITTED"] ?? 0) + (counts["UNDER_REVIEW"] ?? 0),
      approved: counts["APPROVED"] ?? 0,
      rejected: counts["REJECTED"] ?? 0,
      activeDeclaration: activeDeclaration
        ? {
          id: activeDeclaration.id,
          uniqueCode: activeDeclaration.uniqueCode,
          status: activeDeclaration.status,
          createdAt: activeDeclaration.createdAt.toISOString(),
          submittedAt: activeDeclaration.submittedAt?.toISOString() ?? null,
          unresolvedComments: activeDeclaration.sectionReviews.length,
        }
        : null,
      codeHistory: codeHistory.map((d) => ({
        id: d.id,
        uniqueCode: d.uniqueCode,
        status: d.status,
        createdAt: d.createdAt.toISOString(),
      })),
      verificationCount,
      timeline,
    },
  };
});
