import prisma from "~/server/utils/prisma";
import { logAudit, AuditActions } from "~/server/utils/audit";
import { notifyVerificationSubmitted } from "~/server/services/notification.service";
import { runAfterResponse } from "~/server/utils/after-response";
import { canResubmitVerification } from "~/server/utils/verification";

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

  if (!canResubmitVerification(profile.verificationStatus)) {
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

  logAudit(event, {
    userId: auth.userId,
    action: AuditActions.APPLICANT_VERIFICATION_RESUBMITTED,
    entityType: "applicant_profile",
    entityId: profile.id,
    oldValues: { verificationStatus: oldStatus },
    newValues: { verificationStatus: "PENDING_VERIFICATION" },
  });

  logAudit(event, {
    userId: auth.userId,
    action: AuditActions.APPLICANT_VERIFICATION_REQUESTED,
    entityType: "applicant_profile",
    entityId: profile.id,
    newValues: { verificationStatus: "PENDING_VERIFICATION" },
  });

  // Dedupe key includes the post-update timestamp so each legitimate
  // resubmit fires a fresh notification while still absorbing
  // double-clicks within the dedupe window.
  runAfterResponse(
    notifyVerificationSubmitted(
      auth.userId,
      profile.fullName,
      `${profile.id}:${updatedProfile.updatedAt.getTime()}`,
    ),
    "notify:VERIFICATION_SUBMITTED",
  );

  return {
    success: true,
    message: "Verification resubmitted successfully",
    data: { verificationStatus: updatedProfile.verificationStatus },
  };
});
