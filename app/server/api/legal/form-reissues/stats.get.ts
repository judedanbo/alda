import prisma from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const [pending, approved, declined] = await Promise.all([
    prisma.formReissueRequest.count({ where: { status: "PENDING" } }),
    prisma.formReissueRequest.count({ where: { status: "APPROVED" } }),
    prisma.formReissueRequest.count({ where: { status: "DECLINED" } }),
  ]);

  return {
    success: true,
    data: {
      PENDING: pending,
      APPROVED: approved,
      DECLINED: declined,
      total: pending + approved + declined,
    },
  };
});
