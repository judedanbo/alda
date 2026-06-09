import prisma from "~/server/utils/prisma";
import { requireRoles } from "~/server/utils/authz";
import type { VerificationStatus } from "@prisma/client";
import { presignStored } from "~/server/services/storage.service";
import { decryptProfileIds, hashPii } from "~/server/utils/pii-encryption";
import { ID_NUMBER_PATTERNS } from "~/server/utils/validators";

export default defineEventHandler(async (event) => {
  // /api/legal is role-gated in server/middleware/auth.ts; re-assert here as
  // defense-in-depth so a middleware regression cannot expose the handler.
  requireRoles(event, ["legal_unit"]);

  const query = getQuery(event);
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
  const skip = (page - 1) * limit;
  const status = query.status as VerificationStatus | undefined;
  const search = (query.search as string)?.trim();

  const where: Record<string, unknown> = {};

  if (status) {
    where.verificationStatus = status;
  }

  if (search) {
    // National-ID columns are encrypted; substring search is no longer
    // possible. If the search term looks like a full canonical ID number
    // (matches one of the validator patterns), include an exact-match
    // hash lookup as an OR branch alongside the name/email substring
    // matches. Otherwise we just search name + email.
    const idCandidate = search.trim().toUpperCase();
    const idMatches: Record<string, unknown>[] = [];
    if (ID_NUMBER_PATTERNS.GHANA_CARD.test(idCandidate)) {
      idMatches.push({ ghanaCardNumberHash: hashPii(idCandidate) });
    } else {
      for (const t of ["PASSPORT", "VOTER_ID", "DRIVERS_LICENSE", "NIA_RECEIPT"] as const) {
        if (ID_NUMBER_PATTERNS[t].test(idCandidate)) {
          idMatches.push({ idType: t, alternateIdNumberHash: hashPii(idCandidate) });
        }
      }
    }
    where.OR = [
      { fullName: { contains: search, mode: "insensitive" } },
      { user: { email: { contains: search, mode: "insensitive" } } },
      ...idMatches,
    ];
  }

  const [profiles, total] = await Promise.all([
    prisma.applicantProfile.findMany({
      where,
      include: {
        user: { select: { email: true, phone: true, createdAt: true } },
        offices: {
          include: {
            institution: { select: { name: true } },
            officeCategory: { select: { name: true, articleReference: true } },
          },
          orderBy: { startDate: "desc" as const },
          take: 1,
        },
        verificationReviews: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            reviewer: { select: { email: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.applicantProfile.count({ where }),
  ]);

  const signedProfiles = await Promise.all(
    profiles.map(async (p) => {
      const [ghanaCardFrontUrl, ghanaCardBackUrl, alternateIdScanUrl] = await Promise.all([
        presignStored(p.ghanaCardFrontUrl),
        presignStored(p.ghanaCardBackUrl),
        presignStored(p.alternateIdScanUrl),
      ]);
      const decrypted = decryptProfileIds(p);
      return { ...decrypted, ghanaCardFrontUrl, ghanaCardBackUrl, alternateIdScanUrl };
    }),
  );

  return {
    success: true,
    data: {
      profiles: signedProfiles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  };
});
