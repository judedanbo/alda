import prisma from "~/server/utils/prisma";
import { requireRoles } from "~/server/utils/authz";

export default defineEventHandler(async (event) => {
  // /api/legal is role-gated in server/middleware/auth.ts; re-assert here as
  // defense-in-depth so a middleware regression cannot expose the handler.
  requireRoles(event, ["legal_unit"]);

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
