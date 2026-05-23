import prisma from "~/server/utils/prisma";
import { validateBody, formCollectionRecordSchema } from "~/server/utils/validators";
import { logAction, AuditActions } from "~/server/utils/audit";
import { sendNotification } from "~/server/services/notification.service";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;

  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  // Check if user is a schedule officer or admin
  const userRoles = await prisma.userRole.findMany({
    where: { userId: auth.userId },
    include: { role: true },
  });

  const allowedRoles = ["schedule_officer", "admin"];
  const hasAccess = userRoles.some((ur) => allowedRoles.includes(ur.role.name));

  if (!hasAccess) {
    throw createError({
      statusCode: 403,
      statusMessage: "Access denied. Schedule Officer or Admin role required.",
    });
  }

  const data = await validateBody(event, formCollectionRecordSchema);

  // Get the declaration
  const declaration = await prisma.declaration.findUnique({
    where: { id: data.declarationId },
    include: {
      applicant: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!declaration) {
    throw createError({
      statusCode: 404,
      statusMessage: "Declaration not found",
    });
  }

  // Check if declaration is in the correct status
  if (declaration.status !== "CODE_GENERATED") {
    throw createError({
      statusCode: 400,
      statusMessage: `Cannot record form collection. Declaration status is ${declaration.status}, expected CODE_GENERATED.`,
    });
  }

  // Check if a form collection has already been recorded
  const existingCollection = await prisma.formCollection.findFirst({
    where: { declarationId: data.declarationId },
  });

  if (existingCollection) {
    throw createError({
      statusCode: 400,
      statusMessage: "Form collection already recorded for this declaration",
    });
  }

  // Validate the collection office exists and is active
  const collectionOffice = await prisma.collectionOffice.findUnique({
    where: { id: data.collectionOfficeId },
  });

  if (!collectionOffice || !collectionOffice.isActive) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid or inactive collection office",
    });
  }

  // Create form collection and update declaration status
  const [formCollection] = await prisma.$transaction([
    prisma.formCollection.create({
      data: {
        declarationId: data.declarationId,
        recordedBy: auth.userId,
        collectionOfficeId: data.collectionOfficeId,
        collectedAt: new Date(),
        notes: data.notes,
      },
      include: {
        declaration: {
          include: {
            applicant: true,
          },
        },
        collectionOffice: true,
        recorder: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    }),
    prisma.declaration.update({
      where: { id: data.declarationId },
      data: { status: "FORM_COLLECTED" },
    }),
    prisma.declarationStatusHistory.create({
      data: {
        declarationId: data.declarationId,
        status: "FORM_COLLECTED",
        changedById: auth.userId,
        notes: `Physical form collected from ${collectionOffice.name}; recorded by GAS officer`,
      },
    }),
  ]);

  // Log the action
  await logAction({
    userId: auth.userId,
    action: AuditActions.FORM_COLLECTION_RECORDED,
    entityType: "form_collection",
    entityId: formCollection.id,
    newValues: {
      declarationId: data.declarationId,
      collectionOfficeId: data.collectionOfficeId,
      notes: data.notes,
    },
    event,
  });

  // Create notification for applicant
  if (declaration.applicant.user) {
    await sendNotification({
      userId: declaration.applicant.user.id,
      type: "FORM_COLLECTED",
      title: "Declaration Form Collected",
      message: `Your asset declaration form (${declaration.uniqueCode}) has been collected from ${collectionOffice.name}. Please complete and return it.`,
      metadata: {
        declarationId: declaration.id,
        uniqueCode: declaration.uniqueCode,
        collectionOffice: collectionOffice.name,
      },
      dedupeKey: formCollection.id,
    });
  }

  return {
    success: true,
    message: "Form collection recorded successfully",
    data: formCollection,
  };
});
