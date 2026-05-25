import prisma from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;

  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  let prefs = await prisma.accessibilityPreference.findUnique({
    where: { userId: auth.userId },
  });

  if (!prefs) {
    prefs = await prisma.accessibilityPreference.create({
      data: { userId: auth.userId },
    });
  }

  return {
    success: true,
    data: {
      textSize: prefs.textSize,
      reduceMotion: prefs.reduceMotion,
      underlineLinks: prefs.underlineLinks,
      readableFont: prefs.readableFont,
    },
  };
});
