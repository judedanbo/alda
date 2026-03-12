import prisma from "~/server/utils/prisma";
import { validateBody, pickupAuthorizationSchema } from "~/server/utils/validators";
import { logAction } from "~/server/utils/audit";
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

  const declarationId = getRouterParam(event, "declarationId");

  if (!declarationId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Declaration ID is required",
    });
  }

  const body = await readBody(event);
  const data = await validateBody(event, pickupAuthorizationSchema.omit({ declarationId: true }));

  // Get the declaration
  const declaration = await prisma.declaration.findUnique({
    where: { id: declarationId },
    include: {
      applicant: {
        include: {
          user: true,
        },
      },
      receipt: true,
      pickupAuthorization: true,
    },
  });

  if (!declaration) {
    throw createError({
      statusCode: 404,
      statusMessage: "Declaration not found",
    });
  }

  // Check if declaration has a receipt (SEALED status)
  if (declaration.status !== "SEALED" || !declaration.receipt) {
    throw createError({
      statusCode: 400,
      statusMessage: "Receipt must be generated before scheduling pickup",
    });
  }

  // Check if pickup already scheduled
  if (declaration.pickupAuthorization) {
    throw createError({
      statusCode: 400,
      statusMessage: "Pickup already scheduled for this declaration",
    });
  }

  // Create pickup authorization
  const pickupAuthorization = await prisma.pickupAuthorization.create({
    data: {
      declarationId,
      isSelfPickup: data.isSelfPickup,
      authorizedName: data.isSelfPickup ? declaration.applicant.fullName : data.authorizedName,
      authorizedPhone: data.isSelfPickup ? declaration.applicant.user?.phone : data.authorizedPhone,
    },
    include: {
      declaration: {
        include: {
          applicant: true,
          receipt: true,
        },
      },
    },
  });

  // Log the action
  await logAction({
    userId: auth.userId,
    action: "PICKUP_SCHEDULED",
    entityType: "pickupAuthorization",
    entityId: pickupAuthorization.id,
    newValues: {
      declarationId,
      isSelfPickup: data.isSelfPickup,
      authorizedName: pickupAuthorization.authorizedName,
    },
    event,
  });

  // Send notification to applicant
  if (declaration.applicant.user) {
    const user = declaration.applicant.user;

    const pickupMessage = data.isSelfPickup
      ? "Your receipt is ready for pickup. Please visit the Ghana Audit Service office with your Ghana Card."
      : `Your receipt is ready for pickup. ${data.authorizedName} has been authorized to collect it on your behalf.`;

    await sendNotification({
      userId: user.id,
      type: "PICKUP_REMINDER",
      title: "Receipt Ready for Pickup",
      message: pickupMessage,
      metadata: {
        declarationId,
        receiptNumber: declaration.receipt.receiptNumber,
        isSelfPickup: data.isSelfPickup,
        authorizedPerson: data.isSelfPickup ? null : data.authorizedName,
      },
      channels: {
        email: {
          to: user.email,
          template: "pickup",
          data: {
            applicantName: declaration.applicant.fullName,
            receiptNumber: declaration.receipt.receiptNumber,
            isSelfPickup: data.isSelfPickup,
            authorizedName: data.authorizedName,
            officeAddress: "Ghana Audit Service, Ministry Enclave, Accra",
            officeHours: "Monday - Friday, 8:00 AM - 5:00 PM",
          },
        },
        sms: user.phone
          ? {
              to: user.phone,
              message: `ADLA: Your receipt (${declaration.receipt.receiptNumber}) is ready for pickup at Ghana Audit Service. ${data.isSelfPickup ? "Bring your Ghana Card." : `Authorized: ${data.authorizedName}`}`,
            }
          : undefined,
      },
    });
  }

  return {
    success: true,
    message: "Pickup scheduled successfully",
    data: pickupAuthorization,
  };
});
