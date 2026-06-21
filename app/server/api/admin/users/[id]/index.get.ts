import prisma from "~/server/utils/prisma";
import { decryptProfileIds } from "~/server/utils/pii-encryption";
import { logAudit, AuditActions } from "~/server/utils/audit";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const callerRoles = await prisma.userRole.findMany({
    where: { userId: auth.userId },
    include: { role: true },
  });
  if (!callerRoles.some((ur) => ur.role.name === "admin")) {
    throw createError({
      statusCode: 403,
      statusMessage: "Access denied. Admin role required.",
    });
  }

  const userId = getRouterParam(event, "id");
  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: "User ID is required" });
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      phoneVerified: true,
      emailVerified: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      roles: { include: { role: true } },
      assignedOffices: {
        select: {
          collectionOffice: { select: { id: true, name: true, type: true, region: true } },
        },
      },
      applicantProfile: {
        select: {
          fullName: true,
          idType: true,
          ghanaCardNumberCipher: true,
          alternateIdNumberCipher: true,
          offices: {
            include: { officeCategory: true, institution: true },
            orderBy: { startDate: "desc" as const },
          },
        },
      },
    },
  });

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: "User not found" });
  }

  // Compliance: this detail view decrypts the target's national ID when they
  // have an applicant profile — record the PII access. Accounts without a
  // profile (staff-only users) expose no national ID, so no log is written.
  if (user.applicantProfile) {
    logAudit(event, {
      userId: auth.userId,
      action: AuditActions.APPLICANT_PII_VIEWED,
      entityType: "applicant_profile",
      entityId: userId,
      newValues: { context: "admin_user_detail", idType: user.applicantProfile.idType },
    });
  }

  // Recent activity: both actions performed BY this user and actions performed
  // ON this account (entityId), newest first. Powers the detail-page timeline.
  const activity = await prisma.auditLog.findMany({
    where: { OR: [{ userId }, { entityId: userId, entityType: { in: ["user", "User"] } }] },
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  return {
    success: true,
    data: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      phoneVerified: user.phoneVerified,
      emailVerified: user.emailVerified,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt?.toISOString() || null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      roles: user.roles.map((r) => r.role.name),
      collectionOffices: user.assignedOffices.map((a) => a.collectionOffice),
      activated: user.emailVerified,
      profile: user.applicantProfile
        ? (() => {
            const decrypted = decryptProfileIds(user.applicantProfile);
            return {
              fullName: user.applicantProfile!.fullName,
              idType: user.applicantProfile!.idType,
              ghanaCardNumber: decrypted.ghanaCardNumber,
              alternateIdNumber: decrypted.alternateIdNumber,
              offices: user.applicantProfile!.offices,
            };
          })()
        : null,
      activity: activity.map((a) => ({
        id: a.id,
        action: a.action,
        entityType: a.entityType,
        entityId: a.entityId,
        createdAt: a.createdAt.toISOString(),
      })),
    },
  };
});
