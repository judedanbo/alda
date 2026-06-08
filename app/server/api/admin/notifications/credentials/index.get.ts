import prisma from "~/server/utils/prisma";
import { getCredentialStatus } from "~/server/utils/notification-config";

/**
 * Admin: current notification-credential status (Notifications → Settings).
 *
 * Returns per-field resolution source (db / env / unset) and, for NON-secret
 * fields only, the effective value. Secret values are never returned — the UI
 * is write-only. Grouped into smtp / sms for rendering.
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

  const fields = await getCredentialStatus();
  return {
    success: true,
    data: {
      smtp: fields.filter((f) => f.group === "smtp"),
      sms: fields.filter((f) => f.group === "sms"),
    },
  };
});
