import prisma from "~/server/utils/prisma";
import { logAction } from "~/server/utils/audit";
import { validateBody, adminUserOfficesSchema } from "~/server/utils/validators";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const callerRoles = await prisma.userRole.findMany({
    where: { userId: auth.userId },
    include: { role: true },
  });
  if (!callerRoles.some((ur) => ur.role.name === "admin")) {
    throw createError({
      statusCode: 403,
      statusMessage: "Access denied. Admin role required.",
    });
  }

  const userId = getRouterParam(event, "id");
  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: "User ID is required" });
  }

  const { collectionOfficeIds } = await validateBody(event, adminUserOfficesSchema);

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { assignedOffices: true },
  });
  if (!targetUser) {
    throw createError({ statusCode: 404, statusMessage: "User not found" });
  }

  if (collectionOfficeIds.length > 0) {
    const count = await prisma.collectionOffice.count({
      where: { id: { in: collectionOfficeIds }, isActive: true },
    });
    if (count !== collectionOfficeIds.length) {
      throw createError({
        statusCode: 400,
        statusMessage: "Bad Request",
        message: "One or more selected collection offices do not exist",
      });
    }
  }

  const oldOffices = targetUser.assignedOffices.map((o) => o.collectionOfficeId);

  await prisma.$transaction([
    prisma.userCollectionOffice.deleteMany({ where: { userId } }),
    prisma.userCollectionOffice.createMany({
      data: collectionOfficeIds.map((collectionOfficeId) => ({ userId, collectionOfficeId })),
    }),
  ]);

  await logAction({
    userId: auth.userId,
    action: "office_assign",
    entityType: "User",
    entityId: userId,
    oldValues: { collectionOfficeIds: oldOffices },
    newValues: { collectionOfficeIds },
    event,
  });

  return { success: true, message: "Office assignments updated" };
});
