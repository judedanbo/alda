import prisma from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;

  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  const declarationId = getRouterParam(event, "declarationId");
  if (!declarationId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Declaration ID is required",
    });
  }

  const declaration = await prisma.declaration.findUnique({
    where: { id: declarationId },
    select: { applicantId: true, applicant: { select: { userId: true } } },
  });

  if (!declaration) {
    throw createError({
      statusCode: 404,
      statusMessage: "Declaration not found",
    });
  }

  const userRoles = await prisma.userRole.findMany({
    where: { userId: auth.userId },
    include: { role: true },
  });

  const staffRoles = ["schedule_officer", "admin", "legal_unit"];
  const isStaff = userRoles.some((ur) => staffRoles.includes(ur.role.name));
  const isOwner = declaration.applicant.userId === auth.userId;

  if (!isStaff && !isOwner) {
    throw createError({
      statusCode: 403,
      statusMessage: "Access denied",
    });
  }

  const sectionReviews = await prisma.declarationSectionReview.findMany({
    where: { declarationId },
    include: {
      reviewer: { select: { id: true, email: true } },
      resolvedBy: { select: { id: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    success: true,
    data: sectionReviews,
  };
});
