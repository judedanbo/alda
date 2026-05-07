import prisma from "~/server/utils/prisma";
import { validateBody, verificationReviewSchema } from "~/server/utils/validators";
import { createAuditLog, AuditActions } from "~/server/utils/audit";
import { notifyVerificationStatusChanged } from "~/server/services/notification.service";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const id = getRouterParam(event, "id");
  const body = await validateBody(event, verificationReviewSchema);

  const profile = await prisma.applicantProfile.findUnique({
    where: { id },
    include: { user: { select: { id: true } } },
  });

  if (!profile) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Applicant profile not found",
    });
  }

  const oldStatus = profile.verificationStatus;

  const [updatedProfile, review] = await prisma.$transaction([
    prisma.applicantProfile.update({
      where: { id },
      data: { verificationStatus: body.status },
    }),
    prisma.applicantVerificationReview.create({
      data: {
        applicantId: id!,
        reviewerId: auth.userId,
        status: body.status,
        reason: body.reason,
        messageToApplicant: body.messageToApplicant,
      },
    }),
  ]);

  const statusAuditMap: Record<string, string> = {
    VERIFIED: AuditActions.APPLICANT_VERIFICATION_VERIFIED,
    ON_HOLD: AuditActions.APPLICANT_VERIFICATION_ON_HOLD,
    MORE_INFO_REQUIRED: AuditActions.APPLICANT_VERIFICATION_MORE_INFO,
    REJECTED: AuditActions.APPLICANT_VERIFICATION_REJECTED,
  };

  await createAuditLog(event, {
    userId: auth.userId,
    action: AuditActions.APPLICANT_VERIFICATION_REVIEWED,
    entityType: "applicant_profile",
    entityId: id,
    oldValues: { verificationStatus: oldStatus },
    newValues: {
      verificationStatus: body.status,
      reason: body.reason,
      messageToApplicant: body.messageToApplicant,
      reviewerId: auth.userId,
    },
  });

  await createAuditLog(event, {
    userId: auth.userId,
    action: statusAuditMap[body.status]!,
    entityType: "applicant_profile",
    entityId: id,
    oldValues: { verificationStatus: oldStatus },
    newValues: { verificationStatus: body.status },
  });

  await notifyVerificationStatusChanged(
    profile.user.id,
    body.status,
    profile.fullName,
    body.reason,
    body.messageToApplicant,
  );

  return {
    success: true,
    message: `Applicant verification status updated to ${body.status}`,
    data: { profile: updatedProfile, review },
  };
});
