import prisma from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const id = getRouterParam(event, "id");

  const request = await prisma.formReissueRequest.findUnique({
    where: { id },
    include: {
      declaration: {
        include: {
          applicant: {
            include: {
              user: { select: { id: true, email: true, phone: true } },
              offices: {
                include: {
                  institution: true,
                  officeCategory: true,
                },
                orderBy: { startDate: "desc" as const },
              },
            },
          },
          formCollections: {
            include: { collectionOffice: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          formReissueRequests: {
            include: {
              requestedBy: { select: { email: true } },
              reviewedBy: { select: { email: true } },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      },
      requestedBy: { select: { email: true } },
      reviewedBy: { select: { email: true } },
    },
  });

  if (!request) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Reissue request not found",
    });
  }

  return {
    success: true,
    data: request,
  };
});
