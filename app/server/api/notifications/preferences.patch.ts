import prisma from "~/server/utils/prisma";
import { validateBody, notificationPreferencesSchema } from "~/server/utils/validators";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;

  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  const data = await validateBody(event, notificationPreferencesSchema);

  const preferences = await prisma.notificationPreference.upsert({
    where: { userId: auth.userId },
    update: data,
    create: {
      userId: auth.userId,
      ...data,
    },
  });

  return {
    success: true,
    message: "Preferences updated successfully",
    data: preferences,
  };
});
