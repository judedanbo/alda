import prisma from "~/server/utils/prisma";
import { logAction } from "~/server/utils/audit";

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

  // Get the pickup authorization
  const pickupAuth = await prisma.pickupAuthorization.findFirst({
    where: { declarationId },
    include: {
      declaration: {
        include: {
          applicant: true,
        },
      },
    },
  });

  if (!pickupAuth) {
    throw createError({
      statusCode: 404,
      statusMessage: "Pickup authorization not found",
    });
  }

  if (pickupAuth.pickedUp) {
    throw createError({
      statusCode: 400,
      statusMessage: "Receipt already picked up",
    });
  }

  // Update pickup status
  const [updatedPickup] = await prisma.$transaction([
    prisma.pickupAuthorization.update({
      where: { id: pickupAuth.id },
      data: {
        pickedUp: true,
        pickupDate: new Date(),
      },
    }),
    prisma.declaration.update({
      where: { id: declarationId },
      data: { status: "COMPLETED" },
    }),
    prisma.declarationStatusHistory.create({
      data: {
        declarationId,
        status: "COMPLETED",
        changedById: auth.userId,
        notes: `Receipt picked up by ${pickupAuth.authorizedName}`,
      },
    }),
  ]);

  // Log the action
  await logAction({
    userId: auth.userId,
    action: "PICKUP_COMPLETED",
    entityType: "pickupAuthorization",
    entityId: pickupAuth.id,
    oldValues: { pickedUp: false },
    newValues: { pickedUp: true, pickupDate: updatedPickup.pickupDate },
    event,
  });

  return {
    success: true,
    message: "Pickup recorded successfully",
    data: updatedPickup,
  };
});
