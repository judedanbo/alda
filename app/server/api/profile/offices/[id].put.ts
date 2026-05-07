import prisma from "~/server/utils/prisma";
import { validateBody, officeSchema } from "~/server/utils/validators";
import { createAuditLog, AuditActions } from "~/server/utils/audit";

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

  const data = await validateBody(event, officeSchema);

  const category = await prisma.publicOfficeCategory.findUnique({
    where: { id: data.officeCategoryId },
  });

  if (!category || !category.isActive) {
    throw createError({
      statusCode: 400,
      message: "Invalid or inactive office category",
    });
  }

  if (data.institutionId) {
    const institution = await prisma.institution.findUnique({
      where: { id: data.institutionId },
    });

    if (!institution) {
      throw createError({ statusCode: 400, message: "Invalid institution ID" });
    }
  }

  const oldValues = {
    designation: existing.designation,
    officeCategoryId: existing.officeCategoryId,
    institutionId: existing.institutionId,
    startDate: existing.startDate.toISOString(),
    endDate: existing.endDate?.toISOString() || null,
  };

  const updated = await prisma.applicantOffice.update({
    where: { id: officeId },
    data: {
      designation: data.designation,
      officeCategoryId: data.officeCategoryId,
      institutionId: data.institutionId || null,
      startDate: data.startDate,
      endDate: data.endDate || null,
    },
    include: {
      officeCategory: true,
      institution: true,
    },
  });

  await createAuditLog(event, {
    userId: auth.userId,
    action: AuditActions.OFFICE_UPDATED,
    entityType: "applicant_office",
    entityId: updated.id,
    oldValues,
    newValues: {
      designation: updated.designation,
      officeCategoryId: updated.officeCategoryId,
      institutionId: updated.institutionId,
      startDate: updated.startDate.toISOString(),
      endDate: updated.endDate?.toISOString() || null,
    },
  });

  return { success: true, message: "Office updated successfully", data: updated };
});
