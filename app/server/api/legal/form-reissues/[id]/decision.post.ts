import prisma from "~/server/utils/prisma";
import { validateBody, reissueDecisionSchema } from "~/server/utils/validators";
import { logAction, AuditActions } from "~/server/utils/audit";
import {
  notifyFormReissueApproved,
  notifyFormReissueDeclined,
} from "~/server/services/notification.service";
import { presignStored } from "~/server/services/storage.service";

const approverLabels: Record<string, string> = {
  AUDITOR_GENERAL: "the Auditor General",
  REGIONAL_AUDITOR: "a Regional Auditor",
};

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const id = getRouterParam(event, "id");
  const body = await validateBody(event, reissueDecisionSchema);

  const request = await prisma.formReissueRequest.findUnique({
    where: { id },
    include: {
      declaration: {
        include: {
          applicant: {
            include: { user: true },
          },
        },
      },
    },
  });

  if (!request) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Reissue request not found",
    });
  }

  if (request.status !== "PENDING") {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "This reissue request has already been decided.",
    });
  }

  if (request.declaration.status !== "FORM_COLLECTED") {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: `Cannot decide reissue. Declaration status is ${request.declaration.status}, expected FORM_COLLECTED.`,
    });
  }

  const isApproved = body.status === "APPROVED";
  const reviewedAt = new Date();

  const approverLabel = body.approverType
    ? approverLabels[body.approverType] ?? body.approverType
    : "the Auditor General";

  const historyNote = isApproved
    ? `Form reissue approved by ${approverLabel}${
        body.approverDetail ? ` (${body.approverDetail})` : ""
      }; reissued form to be returned via the normal Form Return step`
    : `Form reissue declined: ${body.decisionReason}`;

  const [updatedRequest] = await prisma.$transaction([
    prisma.formReissueRequest.update({
      where: { id },
      data: {
        status: body.status,
        reviewedById: auth.userId,
        approverType: isApproved ? body.approverType : undefined,
        approverDetail: isApproved ? body.approverDetail : undefined,
        letterScanUrl: isApproved ? body.letterScanUrl : undefined,
        decisionReason: body.decisionReason,
        reviewedAt,
      },
    }),
    prisma.declarationStatusHistory.create({
      data: {
        declarationId: request.declarationId,
        status: "FORM_COLLECTED",
        changedById: auth.userId,
        notes: historyNote,
      },
    }),
  ]);

  await logAction({
    userId: auth.userId,
    action: isApproved
      ? AuditActions.FORM_REISSUE_APPROVED
      : AuditActions.FORM_REISSUE_DECLINED,
    entityType: "form_reissue_request",
    entityId: id,
    oldValues: { status: "PENDING" },
    newValues: {
      status: body.status,
      approverType: body.approverType,
      letterScanUrl: body.letterScanUrl,
      decisionReason: body.decisionReason,
    },
    event,
  });

  if (request.declaration.applicant.user) {
    const userId = request.declaration.applicant.user.id;
    const code = request.declaration.uniqueCode;
    const name = request.declaration.applicant.fullName;

    if (isApproved) {
      await notifyFormReissueApproved(userId, code, name, id);
    } else {
      await notifyFormReissueDeclined(userId, code, name, body.decisionReason!, id);
    }
  }

  return {
    success: true,
    message: isApproved ? "Reissue approved" : "Reissue declined",
    data: {
      ...updatedRequest,
      letterScanUrl: await presignStored(updatedRequest.letterScanUrl),
    },
  };
});
