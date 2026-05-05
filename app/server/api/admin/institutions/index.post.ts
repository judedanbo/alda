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

  const body = await readBody(event);
  const { name, type } = body as { name: string; type: string | null };

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Institution name is required",
    });
  }

  const existing = await prisma.institution.findFirst({
    where: { name: { equals: name.trim(), mode: "insensitive" } },
  });

  if (existing) {
    throw createError({
      statusCode: 400,
      statusMessage: "An institution with this name already exists",
    });
  }

  const institution = await prisma.institution.create({
    data: {
      name: name.trim(),
      type: type || null,
    },
  });

  await logAction({
    userId: auth.userId,
    action: "INSTITUTION_CREATE",
    entityType: "Institution",
    entityId: institution.id,
    newValues: { name: institution.name, type: institution.type },
    event,
  });

  return {
    success: true,
    data: institution,
  };
});
