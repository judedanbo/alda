import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import prisma from "~/server/utils/prisma";
import { validateBody, adminCreateUserSchema } from "~/server/utils/validators";
import { createAuditLog, AuditActions } from "~/server/utils/audit";
import { generateResetToken } from "~/server/utils/code-generator";
import { sendStaffInviteEmail } from "~/server/services/email.service";
import { recordStaffInviteEmail } from "~/server/services/notification.service";
import { ghanaPhoneAlternates, isGhanaPhone, normalizePhoneE164 } from "~/server/utils/phone";

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

  const { email, phone, roleNames, collectionOfficeIds } = await validateBody(
    event,
    adminCreateUserSchema,
  );

  const normalizedPhone = phone ? (normalizePhoneE164(phone) ?? undefined) : undefined;

  // Uniqueness — mirror register.post.ts.
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    throw createError({
      statusCode: 409,
      statusMessage: "Conflict",
      message: "An account with this email already exists",
    });
  }
  if (normalizedPhone) {
    const candidates = isGhanaPhone(normalizedPhone)
      ? ghanaPhoneAlternates(normalizedPhone)
      : [normalizedPhone];
    const phoneOwner = await prisma.user.findFirst({
      where: { phone: { in: candidates } },
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
  }

  // Resolve role names → ids.
  const roles = await prisma.role.findMany({ where: { name: { in: roleNames } } });
  if (roles.length !== roleNames.length) {
    throw createError({
      statusCode: 500,
      statusMessage: "Internal Server Error",
      message: "System configuration error: one or more roles not found",
    });
  }

  // Validate offices exist (only relevant for schedule_officer; schema guarantees
  // the array is empty for non-officers).
  if (collectionOfficeIds.length > 0) {
    const count = await prisma.collectionOffice.count({
      where: { id: { in: collectionOfficeIds }, isActive: true },
    });
    if (count !== collectionOfficeIds.length) {
      throw createError({
        statusCode: 400,
        statusMessage: "Bad Request",
        message: "One or more selected collection offices do not exist",
      });
    }
  }

  // Unusable password — the invitee sets a real one via the invite link.
  // bcrypt cost 13 matches register/reset so future logins compare correctly.
  const passwordHash = await bcrypt.hash(randomUUID(), 13);

  // 72h invite token (reuses PasswordResetToken + reset-password flow).
  const token = generateResetToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 72);

  // Create the user and the invite token atomically — a token-write failure
  // must not leave a stranded account (unusable password, no way to activate).
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        phone: normalizedPhone,
        emailVerified: false,
        isActive: true,
        roles: { create: roles.map((r) => ({ roleId: r.id })) },
        assignedOffices: {
          create: collectionOfficeIds.map((id) => ({ collectionOfficeId: id })),
        },
        notificationPrefs: {
          create: { emailEnabled: true, smsEnabled: true, inAppEnabled: true },
        },
      },
    });
    await tx.passwordResetToken.create({
      data: { userId: created.id, token, expiresAt },
    });
    return created;
  });

  try {
    await createAuditLog(event, {
      userId: auth.userId,
      action: AuditActions.USER_CREATED,
      entityType: "user",
      entityId: user.id,
      newValues: { email: user.email, roles: roleNames, collectionOfficeIds },
    });
  } catch (e) {
    console.error("[admin/users] audit log failed:", e);
  }

  // Send the invite directly (it carries a one-time token), then mirror the
  // outcome into the notification log. Both calls are swallow-all and never
  // throw, so a mail failure can't 500 a request whose user was already
  // created — but it IS now recorded and surfaced to the admin.
  const roleLabels = roleNames.map((r) => ROLE_LABELS[r] ?? r).join(", ");
  const inviteResult = await sendStaffInviteEmail(user.email, roleLabels, token);
  await recordStaffInviteEmail(user.id, inviteResult);

  return {
    success: true,
    inviteEmailSent: inviteResult.success,
    message: inviteResult.success
      ? "Staff user created and invitation sent"
      : "Staff user created, but the invitation email could not be sent. Check email (SMTP) configuration, then use \"Resend invitation\".",
    data: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      roles: roleNames,
      collectionOfficeIds,
    },
  };
});
