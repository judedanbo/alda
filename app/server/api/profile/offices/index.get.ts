import prisma from "~/server/utils/prisma";

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

  const offices = await prisma.applicantOffice.findMany({
    where: { profileId: profile.id },
    include: {
      officeCategory: true,
      institution: true,
    },
    orderBy: { startDate: "desc" },
  });

  return { success: true, data: offices };
});
