import prisma from "~/server/utils/prisma";
import { logAction, AuditActions } from "~/server/utils/audit";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;

  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  const idParam = getRouterParam(event, "id");
  const id = Number(idParam);

  if (!idParam || isNaN(id)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Valid category ID is required",
    });
  }

  const existing = await prisma.publicOfficeCategory.findUnique({
    where: { id },
  });

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: "Category not found",
    });
  }

  await prisma.publicOfficeCategory.update({
    where: { id },
    data: { isActive: false },
  });

  await logAction({
    userId: auth.userId,
    action: AuditActions.CATEGORY_DEACTIVATED,
    entityType: "PublicOfficeCategory",
    entityId: String(id),
    oldValues: { isActive: existing.isActive },
    newValues: { isActive: false },
    event,
  });

  return {
    success: true,
    message: "Category deactivated successfully",
  };
});
