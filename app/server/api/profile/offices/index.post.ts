import prisma from "~/server/utils/prisma";
import { validateBody, officeSchema } from "~/server/utils/validators";
import { logAudit, AuditActions } from "~/server/utils/audit";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;

  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const profile = await prisma.applicantProfile.findUnique({
    where: { userId: auth.userId },
  });

  if (!profile) {
    throw createError({
      statusCode: 404,
      message: "Profile not found. Please complete profile setup first.",
    });
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

  const office = await prisma.applicantOffice.create({
    data: {
      profileId: profile.id,
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

  logAudit(event, {
    userId: auth.userId,
    action: AuditActions.OFFICE_ADDED,
    entityType: "applicant_office",
    entityId: office.id,
    newValues: {
      designation: office.designation,
      officeCategoryId: office.officeCategoryId,
      startDate: office.startDate.toISOString(),
    },
  });

  return { success: true, message: "Office added successfully", data: office };
});
