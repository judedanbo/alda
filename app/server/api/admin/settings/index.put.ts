import prisma from "~/server/utils/prisma";
import { validateBody, systemSettingsSchema } from "~/server/utils/validators";
import {
  SETTING_BY_KEY,
  getSettingsStatus,
  invalidateSettingsCache,
} from "~/server/utils/system-settings";
import { createAuditLog, AuditActions } from "~/server/utils/audit";

/**
 * Admin: set / clear global-setting overrides (Admin → Settings).
 *
 * Body `{ set?: { [key]: rawString }, clear?: string[] }`. `set` values are
 * normalised to their canonical string ("true"/"false", the integer) and
 * upserted; `clear` removes the override so the key reverts to its env
 * fallback. Keys are validated against the registry, and values against each
 * field's kind / numeric range. Audit logs record the key + new value (these
 * are non-secret operational flags).
 */
export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }
  const userRoles = await prisma.userRole.findMany({
    where: { userId: auth.userId },
    include: { role: true },
  });
  if (!userRoles.some((ur) => ur.role.name === "admin")) {
    throw createError({ statusCode: 403, statusMessage: "Access denied. Admin role required." });
  }

  const body = await validateBody(event, systemSettingsSchema);
  const setEntries = Object.entries(body.set ?? {});
  const clearKeys = body.clear ?? [];

  // Validate every key against the registry.
  for (const key of [...setEntries.map(([k]) => k), ...clearKeys]) {
    if (!SETTING_BY_KEY.has(key)) {
      throw createError({ statusCode: 400, statusMessage: `Unknown setting key: ${key}` });
    }
  }

  // Validate + normalise each set value against its field's kind/range.
  const normalised: Array<[string, string]> = [];
  for (const [key, value] of setEntries) {
    const field = SETTING_BY_KEY.get(key)!;
    if (field.kind === "boolean") {
      if (value !== "true" && value !== "false") {
        throw createError({ statusCode: 400, statusMessage: `${field.label} must be "true" or "false"` });
      }
      normalised.push([key, value]);
    } else {
      const n = Number(value);
      if (!Number.isFinite(n) || !Number.isInteger(n)) {
        throw createError({ statusCode: 400, statusMessage: `${field.label} must be an integer` });
      }
      if ((field.min != null && n < field.min) || (field.max != null && n > field.max)) {
        throw createError({
          statusCode: 400,
          statusMessage: `${field.label} must be between ${field.min ?? "-∞"} and ${field.max ?? "∞"}`,
        });
      }
      normalised.push([key, String(n)]);
    }
  }

  await Promise.all([
    ...normalised.map(([key, value]) =>
      prisma.systemSetting.upsert({
        where: { key },
        create: { key, value, updatedById: auth.userId },
        update: { value, updatedById: auth.userId },
      }),
    ),
    clearKeys.length
      ? prisma.systemSetting.deleteMany({ where: { key: { in: clearKeys } } })
      : Promise.resolve(),
  ]);

  invalidateSettingsCache();

  // Audit per changed key — these are non-secret flags, so the value is logged.
  for (const [key, value] of normalised) {
    await createAuditLog(event, {
      userId: auth.userId,
      action: AuditActions.SYSTEM_SETTING_UPDATED,
      entityType: "system_setting",
      entityId: key,
      newValues: { key, value },
    });
  }
  if (clearKeys.length) {
    await createAuditLog(event, {
      userId: auth.userId,
      action: AuditActions.SYSTEM_SETTING_CLEARED,
      entityType: "system_setting",
      entityId: clearKeys.join(","),
      newValues: { keys: clearKeys },
    });
  }

  return {
    success: true,
    data: { settings: await getSettingsStatus() },
  };
});
