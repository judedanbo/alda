import prisma from "~/server/utils/prisma";
import { requireRoles } from "~/server/utils/authz";

export default defineEventHandler(async (event) => {
  // /api/legal is role-gated in server/middleware/auth.ts; re-assert here as
  // defense-in-depth so a middleware regression cannot expose the handler.
  requireRoles(event, ["legal_unit"]);

  const [pending, verified, onHold, moreInfo, rejected] = await Promise.all([
    prisma.applicantProfile.count({ where: { verificationStatus: "PENDING_VERIFICATION" } }),
    prisma.applicantProfile.count({ where: { verificationStatus: "VERIFIED" } }),
    prisma.applicantProfile.count({ where: { verificationStatus: "ON_HOLD" } }),
    prisma.applicantProfile.count({ where: { verificationStatus: "MORE_INFO_REQUIRED" } }),
    prisma.applicantProfile.count({ where: { verificationStatus: "REJECTED" } }),
  ]);

  return {
    success: true,
    data: {
      PENDING_VERIFICATION: pending,
      VERIFIED: verified,
      ON_HOLD: onHold,
      MORE_INFO_REQUIRED: moreInfo,
      REJECTED: rejected,
      total: pending + verified + onHold + moreInfo + rejected,
    },
  };
});
