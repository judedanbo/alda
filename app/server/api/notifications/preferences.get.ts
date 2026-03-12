import prisma from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;

  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  let preferences = await prisma.notificationPreference.findUnique({
    where: { userId: auth.userId },
  });

  // Create default preferences if not exist
  if (!preferences) {
    preferences = await prisma.notificationPreference.create({
      data: {
        userId: auth.userId,
        emailEnabled: true,
        smsEnabled: true,
        inAppEnabled: true,
      },
    });
  }

  return {
    success: true,
    data: preferences,
  };
});
