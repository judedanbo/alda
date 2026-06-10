import prisma from "~/server/utils/prisma";
import { requireRoles } from "~/server/utils/authz";
import { presignStored } from "~/server/services/storage.service";
import { decryptProfileIds, hashPii } from "~/server/utils/pii-encryption";

export default defineEventHandler(async (event) => {
  // /api/legal is role-gated in server/middleware/auth.ts; re-assert here as
  // defense-in-depth so a middleware regression cannot expose the handler.
  requireRoles(event, ["legal_unit"]);

  const id = getRouterParam(event, "id");

  const profile = await prisma.applicantProfile.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          phone: true,
          emailVerified: true,
          createdAt: true,
        },
      },
      offices: {
        include: {
          institution: true,
          officeCategory: true,
        },
        orderBy: { startDate: "desc" as const },
      },
      verificationReviews: {
        orderBy: { createdAt: "desc" },
        include: {
          reviewer: { select: { email: true } },
        },
      },
    },
  });

  if (!profile) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Applicant profile not found",
    });
  }

  // Cross-check the applicant's identity document against every other
  // applicant profile. National-ID columns are encrypted, so we look up
  // by the HMAC hash column rather than the cipher (which is random per
  // row). The displayed `number` is the decrypted value of this profile.
  const isGhanaCard = profile.idType === "GHANA_CARD";
  const decryptedSelf = decryptProfileIds(profile);
  const normalizedNumber = (
    isGhanaCard ? decryptedSelf.ghanaCardNumber : decryptedSelf.alternateIdNumber
  )?.trim().toUpperCase() ?? "";

  const matchesRaw = normalizedNumber
    ? await prisma.applicantProfile.findMany({
      where: {
        ...(isGhanaCard
          ? { ghanaCardNumberHash: hashPii(normalizedNumber) }
          : { idType: profile.idType, alternateIdNumberHash: hashPii(normalizedNumber) }),
        NOT: { id: profile.id },
      },
      select: {
        id: true,
        fullName: true,
        idType: true,
        ghanaCardNumberCipher: true,
        alternateIdNumberCipher: true,
        verificationStatus: true,
        createdAt: true,
        user: { select: { email: true } },
      },
    })
    : [];
  const matches = matchesRaw.map((m) => decryptProfileIds(m));

  // The bucket is private; re-sign stored keys into short-lived URLs so
  // the reviewer can render the Ghana Card / alternate-ID scans.
  const [ghanaCardFrontUrl, ghanaCardBackUrl, alternateIdScanUrl] = await Promise.all([
    presignStored(profile.ghanaCardFrontUrl),
    presignStored(profile.ghanaCardBackUrl),
    presignStored(profile.alternateIdScanUrl),
  ]);

  return {
    success: true,
    data: {
      ...decryptedSelf,
      ghanaCardFrontUrl,
      ghanaCardBackUrl,
      alternateIdScanUrl,
      idCheck: {
        idType: profile.idType,
        number: normalizedNumber,
        unique: matches.length === 0,
        checkedAt: new Date().toISOString(),
        matches,
      },
    },
  };
});
