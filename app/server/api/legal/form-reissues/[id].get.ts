import prisma from "~/server/utils/prisma";
import { requireRoles } from "~/server/utils/authz";
import { presignStored } from "~/server/services/storage.service";
import { decryptProfileIds } from "~/server/utils/pii-encryption";
import { logAudit, AuditActions } from "~/server/utils/audit";

export default defineEventHandler(async (event) => {
  // /api/legal is role-gated in server/middleware/auth.ts; re-assert here as
  // defense-in-depth so a middleware regression cannot expose the handler.
  requireRoles(event, ["legal_unit"]);

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

  // Re-sign every stored MinIO key the response surfaces — the reissue
  // letter on the top-level request, the Ghana Card / alternate-ID scans on
  // the nested applicant, and the letter on each historical reissue entry.
  const applicant = request.declaration.applicant;
  const [
    letterScanUrl,
    ghanaCardFrontUrl,
    ghanaCardBackUrl,
    alternateIdScanUrl,
    historicalLetters,
  ] = await Promise.all([
    presignStored(request.letterScanUrl),
    presignStored(applicant.ghanaCardFrontUrl),
    presignStored(applicant.ghanaCardBackUrl),
    presignStored(applicant.alternateIdScanUrl),
    Promise.all(
      request.declaration.formReissueRequests.map((r) => presignStored(r.letterScanUrl)),
    ),
  ]);

  // Compliance: a Legal Unit officer opened this reissue request, decrypting
  // the applicant's national ID and minting signed URLs for their ID scans /
  // approval letters — record who viewed whom.
  logAudit(event, {
    userId: event.context.auth?.userId,
    action: AuditActions.APPLICANT_PII_VIEWED,
    entityType: "applicant_profile",
    entityId: applicant.id,
    newValues: {
      context: "form_reissue_review",
      reissueRequestId: request.id,
      declarationCode: request.declaration.uniqueCode,
    },
  });

  return {
    success: true,
    data: {
      ...request,
      letterScanUrl,
      declaration: {
        ...request.declaration,
        applicant: {
          ...decryptProfileIds(applicant),
          ghanaCardFrontUrl,
          ghanaCardBackUrl,
          alternateIdScanUrl,
        },
        formReissueRequests: request.declaration.formReissueRequests.map((r, i) => ({
          ...r,
          letterScanUrl: historicalLetters[i],
        })),
      },
    },
  };
});
