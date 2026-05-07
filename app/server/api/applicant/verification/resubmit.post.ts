import prisma from "~/server/utils/prisma";
import { createAuditLog, AuditActions } from "~/server/utils/audit";
import { notifyVerificationSubmitted } from "~/server/services/notification.service";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const profile = await prisma.applicantProfile.findUnique({
    where: { userId: auth.userId },
  });

  if (!profile) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Profile not found",
    });
  }

  if (profile.verificationStatus !== "REJECTED" && profile.verificationStatus !== "MORE_INFO_REQUIRED") {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Resubmission is only allowed when status is REJECTED or MORE_INFO_REQUIRED",
    });
  }

  const oldStatus = profile.verificationStatus;

  const updatedProfile = await prisma.applicantProfile.update({
    where: { id: profile.id },
    data: { verificationStatus: "PENDING_VERIFICATION" },
  });

  await createAuditLog(event, {
    userId: auth.userId,
    action: AuditActions.APPLICANT_VERIFICATION_RESUBMITTED,
    entityType: "applicant_profile",
    entityId: profile.id,
    oldValues: { verificationStatus: oldStatus },
    newValues: { verificationStatus: "PENDING_VERIFICATION" },
  });

  await createAuditLog(event, {
    userId: auth.userId,
    action: AuditActions.APPLICANT_VERIFICATION_REQUESTED,
    entityType: "applicant_profile",
    entityId: profile.id,
    newValues: { verificationStatus: "PENDING_VERIFICATION" },
  });

  await notifyVerificationSubmitted(auth.userId, profile.fullName);

  return {
    success: true,
    message: "Verification resubmitted successfully",
    data: { verificationStatus: updatedProfile.verificationStatus },
  };
});
