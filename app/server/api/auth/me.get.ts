import prisma from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;

  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
      message: "Not authenticated",
    });
  }

  // Get user with profile
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    include: {
      roles: {
        include: {
          role: true,
        },
      },
      applicantProfile: {
        include: {
          institution: true,
          officeCategory: true,
        },
      },
      notificationPrefs: true,
    },
  });

  if (!user) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "User not found",
    });
  }

  return {
    success: true,
    data: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      emailVerified: user.emailVerified,
      roles: user.roles.map((r) => r.role.name),
      profile: user.applicantProfile
        ? {
            id: user.applicantProfile.id,
            fullName: user.applicantProfile.fullName,
            ghanaCardNumber: user.applicantProfile.ghanaCardNumber,
            designation: user.applicantProfile.designation,
            institution: user.applicantProfile.institution,
            officeCategory: user.applicantProfile.officeCategory,
          }
        : null,
      notificationPreferences: user.notificationPrefs,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    },
  };
});
