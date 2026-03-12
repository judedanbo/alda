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

  // Check if user is legal unit, schedule officer, or admin
  const userRoles = await prisma.userRole.findMany({
    where: { userId: auth.userId },
    include: { role: true },
  });

  const allowedRoles = ["legal_unit", "schedule_officer", "admin"];
  const hasAccess = userRoles.some((ur) => allowedRoles.includes(ur.role.name));

  if (!hasAccess) {
    throw createError({
      statusCode: 403,
      statusMessage: "Access denied. Legal Unit or Officer role required.",
    });
  }

  const code = getRouterParam(event, "code");

  if (!code) {
    throw createError({
      statusCode: 400,
      statusMessage: "Unique code is required",
    });
  }

  // Find declaration by unique code
  const declaration = await prisma.declaration.findUnique({
    where: { uniqueCode: code },
    include: {
      applicant: {
        include: {
          institution: true,
          officeCategory: true,
          user: {
            select: {
              email: true,
              phone: true,
              emailVerified: true,
              createdAt: true,
            },
          },
        },
      },
      submission: {
        include: {
          recordedBy: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      },
      review: {
        include: {
          reviewedBy: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      },
      receipt: true,
      pickupAuthorization: true,
      statusHistory: {
        include: {
          changedBy: {
            select: {
              id: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!declaration) {
    // Log failed verification attempt
    await logAction({
      userId: auth.userId,
      action: "CODE_VERIFICATION_FAILED",
      entityType: "declaration",
      entityId: null,
      newValues: { code, reason: "Code not found" },
      event,
    });

    throw createError({
      statusCode: 404,
      statusMessage: "Declaration not found. Invalid unique code.",
    });
  }

  // Log successful verification
  await logAction({
    userId: auth.userId,
    action: "CODE_VERIFIED",
    entityType: "declaration",
    entityId: declaration.id,
    newValues: { code },
    event,
  });

  return {
    success: true,
    data: {
      declaration,
      verification: {
        verified: true,
        verifiedAt: new Date().toISOString(),
        verifiedBy: auth.userId,
      },
    },
  };
});
