import prisma from "~/server/utils/prisma";
import { validateBody, accessibilityPreferencesSchema } from "~/server/utils/validators";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;

  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  const body = await validateBody(event, accessibilityPreferencesSchema.partial());

  const updated = await prisma.accessibilityPreference.upsert({
    where: { userId: auth.userId },
    update: body,
    create: { userId: auth.userId, ...body },
  });

  return {
    success: true,
    message: "Accessibility preferences saved",
    data: {
      textSize: updated.textSize,
      reduceMotion: updated.reduceMotion,
      underlineLinks: updated.underlineLinks,
      readableFont: updated.readableFont,
    },
  };
});
