import prisma from "~/server/utils/prisma";
import { validateBody, applicantProfileSchema } from "~/server/utils/validators";
import { createAuditLog, AuditActions } from "~/server/utils/audit";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;

  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  // Check if user already has a profile
  const existingProfile = await prisma.applicantProfile.findUnique({
    where: { userId: auth.userId },
  });

  if (existingProfile) {
    throw createError({
      statusCode: 409,
      statusMessage: "Conflict",
      message: "Profile already exists. Use PUT to update.",
    });
  }

  // Validate request body
  const data = await validateBody(event, applicantProfileSchema);

  // Verify Ghana Card number is unique
  const existingCard = await prisma.applicantProfile.findUnique({
    where: { ghanaCardNumber: data.ghanaCardNumber },
  });

  if (existingCard) {
    throw createError({
      statusCode: 409,
      statusMessage: "Conflict",
      message: "A profile with this Ghana Card number already exists",
    });
  }

  // Verify institution exists if provided
  if (data.institutionId) {
    const institution = await prisma.institution.findUnique({
      where: { id: data.institutionId },
    });

    if (!institution) {
      throw createError({
        statusCode: 400,
        statusMessage: "Bad Request",
        message: "Invalid institution ID",
      });
    }
  }

  // Verify office category exists
  const category = await prisma.publicOfficeCategory.findUnique({
    where: { id: data.officeCategoryId },
  });

  if (!category) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Invalid office category ID",
    });
  }

  // Create profile
  const profile = await prisma.applicantProfile.create({
    data: {
      userId: auth.userId,
      fullName: data.fullName,
      ghanaCardNumber: data.ghanaCardNumber,
      ghanaCardFrontUrl: data.ghanaCardFrontUrl || "",
      ghanaCardBackUrl: data.ghanaCardBackUrl,
      institutionId: data.institutionId,
      designation: data.designation,
      officeCategoryId: data.officeCategoryId,
    },
    include: {
      institution: true,
      officeCategory: true,
    },
  });

  // Create audit log
  await createAuditLog(event, {
    userId: auth.userId,
    action: AuditActions.PROFILE_CREATED,
    entityType: "applicant_profile",
    entityId: profile.id,
    newValues: {
      fullName: profile.fullName,
      ghanaCardNumber: profile.ghanaCardNumber,
      designation: profile.designation,
    },
  });

  return {
    success: true,
    message: "Profile created successfully",
    data: profile,
  };
});
