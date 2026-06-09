import prisma from "~/server/utils/prisma";
import { requireRoles } from "~/server/utils/authz";
import type { FormReissueStatus } from "@prisma/client";
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
  const statusParam = (query.status as string) || "PENDING";
  const search = (query.search as string)?.trim();

  const where: Record<string, unknown> = {};

  if (statusParam && statusParam !== "ALL") {
    where.status = statusParam as FormReissueStatus;
  }

  if (search) {
    // National-ID columns are encrypted (C-5); exact-match hash lookup
    // when the search term looks like a canonical ID number.
    const idCandidate = search.trim().toUpperCase();
    const idMatches: Record<string, unknown>[] = [];
    if (ID_NUMBER_PATTERNS.GHANA_CARD.test(idCandidate)) {
      idMatches.push({ declaration: { applicant: { ghanaCardNumberHash: hashPii(idCandidate) } } });
    } else {
      for (const t of ["PASSPORT", "VOTER_ID", "DRIVERS_LICENSE", "NIA_RECEIPT"] as const) {
        if (ID_NUMBER_PATTERNS[t].test(idCandidate)) {
          idMatches.push({
            declaration: { applicant: { idType: t, alternateIdNumberHash: hashPii(idCandidate) } },
          });
        }
      }
    }
    where.OR = [
      { declaration: { uniqueCode: { contains: search, mode: "insensitive" } } },
      { declaration: { applicant: { fullName: { contains: search, mode: "insensitive" } } } },
      ...idMatches,
    ];
  }

  const [requests, total] = await Promise.all([
    prisma.formReissueRequest.findMany({
      where,
      include: {
        declaration: {
          include: {
            applicant: {
              select: {
                fullName: true,
                idType: true,
                ghanaCardNumberCipher: true,
                alternateIdNumberCipher: true,
                user: { select: { email: true } },
              },
            },
          },
        },
        requestedBy: { select: { email: true } },
        reviewedBy: { select: { email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.formReissueRequest.count({ where }),
  ]);

  // Re-sign letterScanUrl per row and decrypt the nested applicant IDs.
  const signedRequests = await Promise.all(
    requests.map(async (r) => ({
      ...r,
      letterScanUrl: await presignStored(r.letterScanUrl),
      declaration: {
        ...r.declaration,
        applicant: decryptProfileIds(r.declaration.applicant),
      },
    })),
  );

  return {
    success: true,
    data: {
      requests: signedRequests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  };
});
