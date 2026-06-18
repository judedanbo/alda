import prisma from "~/server/utils/prisma";
import { validateBody, updateContactSchema } from "~/server/utils/validators";
import { logAudit, AuditActions } from "~/server/utils/audit";
import { issueEmailVerification } from "~/server/utils/email-verification";
import { ghanaPhoneAlternates, isGhanaPhone, normalizePhoneE164 } from "~/server/utils/phone";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
      message: "Not authenticated",
    });
  }

  const { email, phone } = await validateBody(event, updateContactSchema);

  const self = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, email: true, phone: true, emailVerified: true },
  });
  if (!self) {
    throw createError({ statusCode: 404, statusMessage: "Not Found", message: "User not found" });
  }

  const data: {
    email?: string;
    emailVerified?: boolean;
    phone?: string | null;
    phoneVerified?: boolean;
    phoneVerifiedAt?: Date | null;
  } = {};
  let emailChanged = false;
  let phoneChanged = false;

  // Email — unique (case-insensitive), excluding self. Changing it resets the
  // verified flag and triggers a fresh verification email below.
  if (email !== undefined) {
    const normalizedEmail = email.toLowerCase();
    if (normalizedEmail !== self.email) {
      // Email is locked once verified — it can no longer be changed by anyone.
      if (self.emailVerified) {
        throw createError({
          statusCode: 409,
          statusMessage: "Conflict",
          data: {
            fieldErrors: { email: ["Email cannot be changed after it has been verified"] },
            formErrors: [],
          },
        });
      }
      const owner = await prisma.user.findFirst({
        where: { email: normalizedEmail, id: { not: self.id } },
        select: { id: true },
      });
      if (owner) {
        throw createError({
          statusCode: 409,
          statusMessage: "Conflict",
          data: {
            fieldErrors: { email: ["An account with this email already exists"] },
            formErrors: [],
          },
        });
      }
      data.email = normalizedEmail;
      data.emailVerified = false;
      emailChanged = true;
    }
  }

  // Phone — null/empty clears it; otherwise normalize + uniqueness check (Ghana
  // alternates), excluding self. Any change resets phone verification.
  if (phone !== undefined) {
    if (phone === null || phone.trim() === "") {
      if (self.phone !== null) {
        data.phone = null;
        data.phoneVerified = false;
        data.phoneVerifiedAt = null;
        phoneChanged = true;
      }
    } else {
      const normalizedPhone = normalizePhoneE164(phone) ?? undefined;
      if (!normalizedPhone) {
        throw createError({
          statusCode: 400,
          statusMessage: "Bad Request",
          data: { fieldErrors: { phone: ["Invalid phone number"] }, formErrors: [] },
        });
      }
      if (normalizedPhone !== self.phone) {
        const candidates = isGhanaPhone(normalizedPhone)
          ? ghanaPhoneAlternates(normalizedPhone)
          : [normalizedPhone];
        const phoneOwner = await prisma.user.findFirst({
          where: { phone: { in: candidates }, id: { not: self.id } },
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
        data.phoneVerified = false;
        data.phoneVerifiedAt = null;
        phoneChanged = true;
      }
    }
  }

  if (Object.keys(data).length === 0) {
    return { success: true, message: "No changes to apply" };
  }

  const updated = await prisma.user.update({
    where: { id: self.id },
    data,
    select: { id: true, email: true, phone: true, emailVerified: true, phoneVerified: true },
  });

  // Send a verification link to the new address.
  if (emailChanged) {
    await issueEmailVerification(updated.id, updated.email);
  }

  logAudit(event, {
    userId: self.id,
    action: AuditActions.CONTACT_INFO_UPDATED,
    entityType: "user",
    entityId: self.id,
    oldValues: { email: self.email, phone: self.phone },
    newValues: { email: updated.email, phone: updated.phone },
  });

  const message = emailChanged
    ? "Contact details updated. Check your new email for a verification link."
    : "Contact details updated.";

  return {
    success: true,
    message,
    data: {
      email: updated.email,
      phone: updated.phone,
      emailVerified: updated.emailVerified,
      phoneVerified: updated.phoneVerified,
      emailChanged,
      phoneChanged,
    },
  };
});
