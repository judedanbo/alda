import prisma from "~/server/utils/prisma";
import { encryptPii } from "~/server/utils/pii-encryption";
import { validateBody, notificationCredentialsSchema } from "~/server/utils/validators";
import {
  FIELD_BY_KEY,
  invalidateCredentialCache,
  getCredentialStatus,
} from "~/server/utils/notification-config";
import { logAudit, AuditActions } from "~/server/utils/audit";

/**
 * Admin: set / clear notification-credential overrides.
 *
 * Body `{ set?: { [key]: value }, clear?: string[] }`. `set` values are
 * encrypted at rest (encryptPii) and upserted; `clear` removes the override so
 * the key reverts to its env fallback. Keys are validated against the registry;
 * audit logs record the keys changed, never the values.
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

  const body = await validateBody(event, notificationCredentialsSchema);
  const setEntries = Object.entries(body.set ?? {});
  const clearKeys = body.clear ?? [];

  // Validate every key against the registry, and value kinds for sets.
  for (const key of [...setEntries.map(([k]) => k), ...clearKeys]) {
    if (!FIELD_BY_KEY.has(key)) {
      throw createError({ statusCode: 400, statusMessage: `Unknown credential key: ${key}` });
    }
  }
  for (const [key, value] of setEntries) {
    if (value === "") continue; // empty = no-op; use `clear` to revert to env
    const field = FIELD_BY_KEY.get(key)!;
    if (field.kind === "number" && !Number.isFinite(Number(value))) {
      throw createError({ statusCode: 400, statusMessage: `${field.label} must be a number` });
    }
    if (field.kind === "select" && field.options && !field.options.includes(value)) {
      throw createError({ statusCode: 400, statusMessage: `${field.label} must be one of: ${field.options.join(", ")}` });
    }
  }

  // Apply: encrypt+upsert non-empty sets; delete clears.
  const setKeys = setEntries.filter(([, v]) => v !== "").map(([k]) => k);
  await Promise.all([
    ...setEntries
      .filter(([, v]) => v !== "")
      .map(([key, value]) =>
        prisma.notificationCredential.upsert({
          where: { key },
          create: { key, valueCipher: encryptPii(value), updatedById: auth.userId },
          update: { valueCipher: encryptPii(value), updatedById: auth.userId },
        }),
      ),
    clearKeys.length
      ? prisma.notificationCredential.deleteMany({ where: { key: { in: clearKeys } } })
      : Promise.resolve(),
  ]);

  invalidateCredentialCache();

  // Audit the keys changed — never the values.
  if (setKeys.length) {
    logAudit(event, {
      userId: auth.userId,
      action: AuditActions.NOTIFICATION_CREDENTIAL_UPDATED,
      entityType: "notification_credential",
      entityId: setKeys.join(","),
      newValues: { keys: setKeys },
    });
  }
  if (clearKeys.length) {
    logAudit(event, {
      userId: auth.userId,
      action: AuditActions.NOTIFICATION_CREDENTIAL_CLEARED,
      entityType: "notification_credential",
      entityId: clearKeys.join(","),
      newValues: { keys: clearKeys },
    });
  }

  const fields = await getCredentialStatus();
  return {
    success: true,
    data: {
      smtp: fields.filter((f) => f.group === "smtp"),
      sms: fields.filter((f) => f.group === "sms"),
    },
  };
});
