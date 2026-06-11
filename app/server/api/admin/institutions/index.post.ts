import prisma from "~/server/utils/prisma";
import { logAction, AuditActions } from "~/server/utils/audit";
import { validateBody, adminInstitutionCreateSchema } from "~/server/utils/validators";

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

  const { name, type } = await validateBody(event, adminInstitutionCreateSchema);

  const existing = await prisma.institution.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });

  if (existing) {
    throw createError({
      statusCode: 400,
      statusMessage: "An institution with this name already exists",
    });
  }

  const institution = await prisma.institution.create({
    data: {
      name,
      type: type ?? null,
    },
  });

  await logAction({
    userId: auth.userId,
    action: AuditActions.INSTITUTION_CREATED,
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
