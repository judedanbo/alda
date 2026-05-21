import prisma from "~/server/utils/prisma";
import { buildPreferencesPayload } from "~/server/utils/notifications-catalog";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;

  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  let channels = await prisma.notificationPreference.findUnique({
    where: { userId: auth.userId },
  });

  // Create default channel preferences if they don't exist yet
  if (!channels) {
    channels = await prisma.notificationPreference.create({
      data: {
        userId: auth.userId,
        emailEnabled: true,
        smsEnabled: true,
        inAppEnabled: true,
      },
    });
  }

  const typeRows = await prisma.notificationTypePreference.findMany({
    where: { userId: auth.userId },
  });

  return {
    success: true,
    data: buildPreferencesPayload(auth.roles, channels, typeRows),
  };
});
