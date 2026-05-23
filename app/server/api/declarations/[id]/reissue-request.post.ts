import prisma from "~/server/utils/prisma";
import { validateBody, reissueRequestSchema } from "~/server/utils/validators";
import { logAction, AuditActions } from "~/server/utils/audit";
import { notifyFormReissueRequested } from "~/server/services/notification.service";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;

  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Declaration ID is required",
    });
  }

  const data = await validateBody(event, reissueRequestSchema);

  const declaration = await prisma.declaration.findUnique({
    where: { id },
    include: {
      applicant: {
        include: {
          user: true,
        },
      },
      formReissueRequests: {
        where: { status: "PENDING" },
      },
    },
  });

  if (!declaration) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Declaration not found",
    });
  }

  // Only the owning applicant can request a reissue
  if (declaration.applicant.userId !== auth.userId) {
    throw createError({
      statusCode: 403,
      statusMessage: "Forbidden",
      message: "You can only request a reissue for your own declaration",
    });
  }

  if (declaration.status !== "FORM_COLLECTED") {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: `Cannot request a reissue. Declaration status is ${declaration.status}, expected FORM_COLLECTED.`,
    });
  }

  if (declaration.formReissueRequests.length > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: "Conflict",
      message: "A reissue request is already pending for this declaration.",
    });
  }

  const [reissueRequest] = await prisma.$transaction([
    prisma.formReissueRequest.create({
      data: {
        declarationId: id,
        requestedById: auth.userId,
        status: "PENDING",
        applicantNote: data.applicantNote,
      },
    }),
    prisma.declarationStatusHistory.create({
      data: {
        declarationId: id,
        status: "FORM_COLLECTED",
        changedById: auth.userId,
        notes:
          "Applicant reported the collected form lost; reissue requested (offline Auditor General approval pending)",
      },
    }),
  ]);

  await logAction({
    userId: auth.userId,
    action: AuditActions.FORM_REISSUE_REQUESTED,
    entityType: "form_reissue_request",
    entityId: reissueRequest.id,
    newValues: { declarationId: id },
    event,
  });

  if (declaration.applicant.user) {
    await notifyFormReissueRequested(
      declaration.applicant.user.id,
      declaration.uniqueCode,
      declaration.applicant.fullName,
      reissueRequest.id,
    );
  }

  return {
    success: true,
    message: "Reissue request submitted",
    data: reissueRequest,
  };
});
