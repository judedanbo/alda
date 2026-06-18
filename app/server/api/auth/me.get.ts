import prisma from "~/server/utils/prisma";
import { decryptProfileIds } from "~/server/utils/pii-encryption";

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
          offices: {
            include: {
              officeCategory: true,
              institution: true,
            },
            orderBy: { startDate: "desc" as const },
          },
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
      fullName: user.fullName ?? user.applicantProfile?.fullName ?? null,
      phone: user.phone,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      phoneVerifiedAt: user.phoneVerifiedAt,
      roles: user.roles.map((r) => r.role.name),
      profile: user.applicantProfile
        ? {
            id: user.applicantProfile.id,
            fullName: user.applicantProfile.fullName,
            ghanaCardNumber: decryptProfileIds(user.applicantProfile).ghanaCardNumber,
            offices: user.applicantProfile.offices,
            verificationStatus: user.applicantProfile.verificationStatus,
          }
        : null,
      notificationPreferences: user.notificationPrefs,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    },
  };
});
