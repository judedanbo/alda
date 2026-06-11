import prisma from "~/server/utils/prisma";
import { validateBody, notificationPreferencesSchema } from "~/server/utils/validators";
import { logAudit, AuditActions } from "~/server/utils/audit";
import {
  buildPreferencesPayload,
  getControllableTypesForRole,
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

  await prisma.$transaction([
    prisma.notificationPreference.upsert({
      where: { userId: auth.userId },
      update: body.channels,
      create: { userId: auth.userId, ...body.channels },
    }),
    ...body.typePreferences.map((pref) =>
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
    ),
  ]);

  const channels = await prisma.notificationPreference.findUniqueOrThrow({
    where: { userId: auth.userId },
  });
  const typeRows = await prisma.notificationTypePreference.findMany({
    where: { userId: auth.userId },
  });

  // Security-relevant: silencing an alert channel can hide subsequent
  // account/security notifications, so record the new channel + per-type
  // configuration.
  logAudit(event, {
    userId: auth.userId,
    action: AuditActions.NOTIFICATION_PREFERENCES_UPDATED,
    entityType: "notification_preference",
    entityId: auth.userId,
    newValues: { channels: body.channels, typePreferences: body.typePreferences },
  });

  return {
    success: true,
    message: "Preferences updated successfully",
    data: buildPreferencesPayload(auth.roles, channels, typeRows),
  };
});
