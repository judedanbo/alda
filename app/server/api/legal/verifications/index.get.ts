import prisma from "~/server/utils/prisma";
import type { VerificationStatus } from "@prisma/client";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

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
    where.OR = [
      { fullName: { contains: search, mode: "insensitive" } },
      { ghanaCardNumber: { contains: search, mode: "insensitive" } },
      { alternateIdNumber: { contains: search, mode: "insensitive" } },
      { user: { email: { contains: search, mode: "insensitive" } } },
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

  return {
    success: true,
    data: {
      profiles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  };
});
