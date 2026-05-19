import prisma from "~/server/utils/prisma";
import type { FormReissueStatus } from "@prisma/client";

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
                ghanaCardNumber: true,
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

  return {
    success: true,
    data: {
      requests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  };
});
