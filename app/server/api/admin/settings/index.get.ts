import prisma from "~/server/utils/prisma";
import { getSettingsStatus } from "~/server/utils/system-settings";

/**
 * Admin: current global-setting status (Admin → Settings).
 *
 * Returns every registered setting with its resolution source (db / env) and
 * effective typed value. These are non-secret operational flags, so values are
 * returned in full (unlike notification credentials, which are write-only).
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

  return {
    success: true,
    data: { settings: await getSettingsStatus() },
  };
});
