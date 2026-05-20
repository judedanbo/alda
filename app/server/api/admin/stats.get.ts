import prisma from "~/server/utils/prisma";

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

  // Fetch all stats in parallel
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
  ] = await Promise.all([
    // Total users
    prisma.user.count(),

    // Total applicants (users with applicant role)
    prisma.userRole.count({
      where: {
        role: { name: "applicant" },
      },
    }),

    // Total officers (schedule_officer role)
    prisma.userRole.count({
      where: {
        role: { name: "schedule_officer" },
      },
    }),

    // Total declarations
    prisma.declaration.count(),

    // Pending declarations (anything awaiting an officer action before approval)
    prisma.declaration.count({
      where: {
        status: { in: ["CODE_GENERATED", "FORM_COLLECTED", "SUBMITTED", "UNDER_REVIEW"] },
      },
    }),

    // Approved declarations
    prisma.declaration.count({
      where: { status: "APPROVED" },
    }),

    // Rejected declarations
    prisma.declaration.count({
      where: { status: "REJECTED" },
    }),

    // Today's declarations
    prisma.declaration.count({
      where: {
        createdAt: { gte: today },
      },
    }),

    // Recent users (last 10)
    prisma.user.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        isActive: true,
        createdAt: true,
        roles: {
          include: { role: true },
        },
      },
    }),

    // Recent declarations (last 10)
    prisma.declaration.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        uniqueCode: true,
        status: true,
        createdAt: true,
        applicant: {
          select: {
            fullName: true,
          },
        },
      },
    }),

    // Recent audit logs (last 10)
    prisma.auditLog.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        action: true,
        entityType: true,
        ipAddress: true,
        createdAt: true,
        user: {
          select: {
            email: true,
          },
        },
      },
    }),
  ]);

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
