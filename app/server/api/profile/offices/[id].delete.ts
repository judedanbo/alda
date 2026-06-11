import prisma from "~/server/utils/prisma";
import { logAudit, AuditActions } from "~/server/utils/audit";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;

  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const officeId = getRouterParam(event, "id");

  if (!officeId) {
    throw createError({ statusCode: 400, message: "Office ID is required" });
  }

  const profile = await prisma.applicantProfile.findUnique({
    where: { userId: auth.userId },
  });

  if (!profile) {
    throw createError({ statusCode: 404, message: "Profile not found" });
  }

  const existing = await prisma.applicantOffice.findUnique({
    where: { id: officeId },
  });

  if (!existing || existing.profileId !== profile.id) {
    throw createError({ statusCode: 404, message: "Office not found" });
  }

  const officeCount = await prisma.applicantOffice.count({
    where: { profileId: profile.id },
  });

  if (officeCount <= 1) {
    throw createError({
      statusCode: 400,
      message: "Cannot remove the last office. At least one office is required.",
    });
  }

  await prisma.applicantOffice.delete({ where: { id: officeId } });

  logAudit(event, {
    userId: auth.userId,
    action: AuditActions.OFFICE_REMOVED,
    entityType: "applicant_office",
    entityId: officeId,
    oldValues: {
      designation: existing.designation,
      officeCategoryId: existing.officeCategoryId,
      institutionId: existing.institutionId,
      startDate: existing.startDate.toISOString(),
      endDate: existing.endDate?.toISOString() || null,
    },
  });

  return { success: true, message: "Office removed successfully" };
});
