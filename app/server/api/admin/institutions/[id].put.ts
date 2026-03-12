import prisma from "~/server/utils/prisma";
import { createAuditLog } from "~/server/utils/audit";

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
  const body = await readBody(event);
  const { name, type, isActive } = body as {
    name: string;
    type: string | null;
    isActive: boolean;
  };

  if (!institutionId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Institution ID is required",
    });
  }

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Institution name is required",
    });
  }

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
      name: { equals: name.trim(), mode: "insensitive" },
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
      name: name.trim(),
      type: type || null,
      isActive: isActive ?? existing.isActive,
    },
  });

  await createAuditLog({
    userId: auth.userId,
    action: "INSTITUTION_UPDATE",
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
