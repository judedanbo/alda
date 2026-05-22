import type { Prisma } from "@prisma/client";
import prisma from "~/server/utils/prisma";
import { validateBody, notificationPreferencesSchema } from "~/server/utils/validators";
import {
  buildPreferencesPayload,
  getControllableTypesForRole,
  defaultFlagsForType,
} from "~/server/utils/notifications-catalog";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;

  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  const body = await validateBody(event, notificationPreferencesSchema);

  const allowedTypes = new Set(getControllableTypesForRole(auth.roles));
  for (const pref of body.typePreferences) {
    if (!allowedTypes.has(pref.type)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Notification type "${pref.type}" cannot be configured`,
      });
    }
  }

  // Per-type rows store only deviations from the catalog default: a type left
  // at its default is deleted, not persisted, so future default changes keep
  // applying to users who never customised that type.
  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.notificationPreference.upsert({
      where: { userId: auth.userId },
      update: body.channels,
      create: { userId: auth.userId, ...body.channels },
    }),
  ];

  for (const pref of body.typePreferences) {
    const defaults = defaultFlagsForType(pref.type);
    const isDefault =
      pref.emailEnabled === defaults.emailEnabled &&
      pref.smsEnabled === defaults.smsEnabled &&
      pref.inAppEnabled === defaults.inAppEnabled;

    if (isDefault) {
      ops.push(
        prisma.notificationTypePreference.deleteMany({
          where: { userId: auth.userId, type: pref.type },
        }),
      );
    } else {
      ops.push(
        prisma.notificationTypePreference.upsert({
          where: { userId_type: { userId: auth.userId, type: pref.type } },
          update: {
            emailEnabled: pref.emailEnabled,
            smsEnabled: pref.smsEnabled,
            inAppEnabled: pref.inAppEnabled,
          },
          create: {
            userId: auth.userId,
            type: pref.type,
            emailEnabled: pref.emailEnabled,
            smsEnabled: pref.smsEnabled,
            inAppEnabled: pref.inAppEnabled,
          },
        }),
      );
    }
  }

  await prisma.$transaction(ops);

  const channels = await prisma.notificationPreference.findUniqueOrThrow({
    where: { userId: auth.userId },
  });
  const typeRows = await prisma.notificationTypePreference.findMany({
    where: { userId: auth.userId },
  });

  return {
    success: true,
    message: "Preferences updated successfully",
    data: buildPreferencesPayload(auth.roles, channels, typeRows),
  };
});
