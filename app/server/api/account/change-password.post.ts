import bcrypt from "bcryptjs";
import prisma from "~/server/utils/prisma";
import { validateBody, changePasswordSchema } from "~/server/utils/validators";
import { logAudit, AuditActions } from "~/server/utils/audit";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
      message: "Not authenticated",
    });
  }

  const { currentPassword, newPassword } = await validateBody(event, changePasswordSchema);

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, passwordHash: true },
  });

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: "Not Found", message: "User not found" });
  }

  // Verify the current password. Use a 400 field error (not 401) so the client's
  // authFetch does not treat this as an expired session and force a logout.
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      data: {
        fieldErrors: { currentPassword: ["Current password is incorrect"] },
        formErrors: [],
      },
    });
  }

  if (newPassword === currentPassword) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      data: {
        fieldErrors: { newPassword: ["New password must be different from your current password"] },
        formErrors: [],
      },
    });
  }

  // bcrypt cost 13 must match register/reset so we never downgrade hash strength.
  const passwordHash = await bcrypt.hash(newPassword, 13);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    }),
    // Revoke all refresh tokens — signs the user out of other devices.
    prisma.refreshToken.deleteMany({
      where: { userId: user.id },
    }),
  ]);

  logAudit(event, {
    userId: user.id,
    action: AuditActions.PASSWORD_CHANGED,
    entityType: "user",
    entityId: user.id,
  });

  return {
    success: true,
    message: "Password changed successfully. Other devices have been signed out.",
  };
});
