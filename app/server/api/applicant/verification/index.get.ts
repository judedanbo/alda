import prisma from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const profile = await prisma.applicantProfile.findUnique({
    where: { userId: auth.userId },
    select: {
      id: true,
      verificationStatus: true,
      verificationReviews: {
        orderBy: { createdAt: "desc" },
        include: {
          reviewer: { select: { email: true } },
        },
      },
    },
  });

  if (!profile) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Profile not found. Please complete your profile first.",
    });
  }

  const latestReview = profile.verificationReviews[0] || null;

  return {
    success: true,
    data: {
      verificationStatus: profile.verificationStatus,
      latestReview: latestReview
        ? {
            status: latestReview.status,
            reason: latestReview.reason,
            messageToApplicant: latestReview.messageToApplicant,
            createdAt: latestReview.createdAt,
          }
        : null,
      reviewHistory: profile.verificationReviews,
    },
  };
});
