import prisma from "~/server/utils/prisma";
import { logAction } from "~/server/utils/audit";
import { generateResetToken } from "~/server/utils/code-generator";
import { sendStaffInviteEmail } from "~/server/services/email.service";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  legal_unit: "Legal Unit",
  schedule_officer: "Schedule Officer",
};

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const callerRoles = await prisma.userRole.findMany({
    where: { userId: auth.userId },
    include: { role: true },
  });
  if (!callerRoles.some((ur) => ur.role.name === "admin")) {
    throw createError({
      statusCode: 403,
      statusMessage: "Access denied. Admin role required.",
    });
  }

  const userId = getRouterParam(event, "id");
  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: "User ID is required" });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { roles: { include: { role: true } } },
  });
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: "User not found" });
  }

  if (user.emailVerified) {
    throw createError({
      statusCode: 409,
      statusMessage: "Conflict",
      message: "This account is already activated",
    });
  }

  // Fresh 72h token; drop any prior tokens for this user.
  const token = generateResetToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 72);
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId } }),
    prisma.passwordResetToken.create({ data: { userId, token, expiresAt } }),
  ]);

  await logAction({
    userId: auth.userId,
    action: "user_invited",
    entityType: "User",
    entityId: userId,
    event,
  });

  const roleLabels = user.roles.map((r) => ROLE_LABELS[r.role.name] ?? r.role.name).join(", ");
  try {
    await sendStaffInviteEmail(user.email, roleLabels, token);
  } catch (e) {
    console.error("Failed to resend staff invite email:", e);
  }

  return { success: true, message: "Invitation resent" };
});
