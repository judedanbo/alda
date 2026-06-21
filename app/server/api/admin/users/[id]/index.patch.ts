import prisma from "~/server/utils/prisma";
import { validateBody, adminUpdateUserSchema } from "~/server/utils/validators";
import { logAudit, AuditActions } from "~/server/utils/audit";
import { ghanaPhoneAlternates, isGhanaPhone, normalizePhoneE164 } from "~/server/utils/phone";

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

  const { email, fullName, phone } = await validateBody(event, adminUpdateUserSchema);

  const target = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true, email: true, fullName: true, phone: true, emailVerified: true },
  });
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: "User not found" });
  }

  const data: { email?: string; fullName?: string; phone?: string | null } = {};

  // Identity (email + full name) is locked once the account's email is verified.
  // Admins may correct these only while the invite is still pending.
  const wantsEmailChange = email !== undefined && email.toLowerCase() !== target.email;
  const wantsNameChange = fullName !== undefined && fullName !== target.fullName;
  if (target.emailVerified && (wantsEmailChange || wantsNameChange)) {
    throw createError({
      statusCode: 409,
      statusMessage: "Conflict",
      message: "Email and full name cannot be changed after the account is verified",
    });
  }

  // Email — unique (case-insensitive), excluding self.
  if (wantsEmailChange) {
    const normalizedEmail = email!.toLowerCase();
    const owner = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (owner && owner.id !== userId) {
      throw createError({
        statusCode: 409,
        statusMessage: "Conflict",
        message: "An account with this email already exists",
      });
    }
    data.email = normalizedEmail;
  }

  // Full name.
  if (wantsNameChange) {
    data.fullName = fullName;
  }

  // Phone — null clears it; otherwise normalize + uniqueness check (Ghana
  // alternates), excluding self. Mirrors index.post.ts.
  if (phone !== undefined) {
    if (phone === null || phone.trim() === "") {
      data.phone = null;
    } else {
      const normalizedPhone = normalizePhoneE164(phone) ?? undefined;
      if (!normalizedPhone) {
        throw createError({
          statusCode: 400,
          statusMessage: "Bad Request",
          data: { fieldErrors: { phone: ["Invalid phone number"] }, formErrors: [] },
        });
      }
      const candidates = isGhanaPhone(normalizedPhone)
        ? ghanaPhoneAlternates(normalizedPhone)
        : [normalizedPhone];
      const phoneOwner = await prisma.user.findFirst({
        where: { phone: { in: candidates }, id: { not: userId } },
        select: { id: true },
      });
      if (phoneOwner) {
        throw createError({
          statusCode: 409,
          statusMessage: "Conflict",
          data: {
            fieldErrors: { phone: ["This phone number is already registered"] },
            formErrors: [],
          },
        });
      }
      data.phone = normalizedPhone;
    }
  }

  if (Object.keys(data).length === 0) {
    return { success: true, message: "No changes to apply" };
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: { id: true, email: true, fullName: true, phone: true },
  });

  logAudit(event, {
    userId: auth.userId,
    action: AuditActions.USER_UPDATED,
    entityType: "user",
    entityId: userId,
    oldValues: { email: target.email, fullName: target.fullName, phone: target.phone },
    newValues: { email: updated.email, fullName: updated.fullName, phone: updated.phone },
  });

  return {
    success: true,
    message: "User updated successfully",
    data: { id: updated.id, email: updated.email, fullName: updated.fullName, phone: updated.phone },
  };
});
