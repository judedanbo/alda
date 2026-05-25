import prisma from "~/server/utils/prisma";
import type { FormReissueStatus } from "@prisma/client";
import { presignStored } from "~/server/services/storage.service";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

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
    where.OR = [
      { declaration: { uniqueCode: { contains: search, mode: "insensitive" } } },
      { declaration: { applicant: { fullName: { contains: search, mode: "insensitive" } } } },
      { declaration: { applicant: { ghanaCardNumber: { contains: search, mode: "insensitive" } } } },
      { declaration: { applicant: { alternateIdNumber: { contains: search, mode: "insensitive" } } } },
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
                ghanaCardNumber: true,
                alternateIdNumber: true,
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

  // Re-sign letterScanUrl per row — list rows render thumbnails / link.
  const signedRequests = await Promise.all(
    requests.map(async (r) => ({
      ...r,
      letterScanUrl: await presignStored(r.letterScanUrl),
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
