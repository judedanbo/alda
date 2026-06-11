import prisma from "~/server/utils/prisma";
import { logAction, AuditActions } from "~/server/utils/audit";
import { validateBody, adminInstitutionUpdateSchema } from "~/server/utils/validators";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;

  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  const userRoles = await prisma.userRole.findMany({
    where: { userId: auth.userId },
    include: { role: true },
  });

  const isAdmin = userRoles.some((ur) => ur.role.name === "admin");

  if (!isAdmin) {
    throw createError({
      statusCode: 403,
      statusMessage: "Access denied. Admin role required.",
    });
  }

  const institutionId = getRouterParam(event, "id");
  if (!institutionId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Institution ID is required",
    });
  }

  const { name, type, isActive } = await validateBody(event, adminInstitutionUpdateSchema);

  const existing = await prisma.institution.findUnique({
    where: { id: institutionId },
  });

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: "Institution not found",
    });
  }

  // Check for duplicate name (excluding current institution)
  const duplicate = await prisma.institution.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      id: { not: institutionId },
    },
  });

  if (duplicate) {
    throw createError({
      statusCode: 400,
      statusMessage: "An institution with this name already exists",
    });
  }

  const institution = await prisma.institution.update({
    where: { id: institutionId },
    data: {
      name,
      type: type ?? null,
      isActive,
    },
  });

  await logAction({
    userId: auth.userId,
    action: AuditActions.INSTITUTION_UPDATED,
    entityType: "Institution",
    entityId: institutionId,
    oldValues: { name: existing.name, type: existing.type, isActive: existing.isActive },
    newValues: { name: institution.name, type: institution.type, isActive: institution.isActive },
    event,
  });

  return {
    success: true,
    data: institution,
  };
});
