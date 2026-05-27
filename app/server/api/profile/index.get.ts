import prisma from "~/server/utils/prisma";
import { presignStored } from "~/server/services/storage.service";

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
    include: {
      offices: {
        include: {
          officeCategory: true,
          institution: true,
        },
        orderBy: { startDate: "desc" as const },
      },
    },
  });

  if (!profile) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Profile not found. Please complete your profile setup.",
    });
  }

  // The bucket is private; re-sign the stored keys into short-lived URLs.
  const [ghanaCardFrontUrl, ghanaCardBackUrl, alternateIdScanUrl] = await Promise.all([
    presignStored(profile.ghanaCardFrontUrl),
    presignStored(profile.ghanaCardBackUrl),
    presignStored(profile.alternateIdScanUrl),
  ]);

  return {
    success: true,
    data: {
      ...profile,
      ghanaCardFrontUrl,
      ghanaCardBackUrl,
      alternateIdScanUrl,
    },
  };
});
