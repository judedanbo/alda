import prisma from "~/server/utils/prisma";
import { requireRoles } from "~/server/utils/authz";
import { validateBody, verificationReviewSchema } from "~/server/utils/validators";
import { logAudit, AuditActions } from "~/server/utils/audit";
import { notifyVerificationStatusChanged } from "~/server/services/notification.service";
import { runAfterResponse } from "~/server/utils/after-response";

export default defineEventHandler(async (event) => {
  // /api/legal is role-gated in server/middleware/auth.ts; re-assert here as
  // defense-in-depth so a middleware regression cannot expose the handler.
  const auth = requireRoles(event, ["legal_unit"]);

  const id = getRouterParam(event, "id");
  const body = await validateBody(event, verificationReviewSchema);

  const [profile, reviewer] = await Promise.all([
    prisma.applicantProfile.findUnique({
      where: { id },
      include: { user: { select: { id: true } } },
    }),
    prisma.user.findUnique({
      where: { id: auth.userId },
      select: { id: true },
    }),
  ]);

  if (!reviewer) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
      message: "Your session is invalid. Please log out and log back in.",
    });
  }

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

  logAudit(event, {
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

  logAudit(event, {
    userId: auth.userId,
    action: statusAuditMap[body.status]!,
    entityType: "applicant_profile",
    entityId: id,
    oldValues: { verificationStatus: oldStatus },
    newValues: { verificationStatus: body.status },
  });

  runAfterResponse(
    notifyVerificationStatusChanged(
      profile.user.id,
      body.status,
      profile.fullName,
      body.reason,
      body.messageToApplicant,
    ),
    "notify:VERIFICATION_STATUS_CHANGED",
  );

  return {
    success: true,
    message: `Applicant verification status updated to ${body.status}`,
    data: { profile: updatedProfile, review },
  };
});
