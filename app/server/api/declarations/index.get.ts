import type { DeclarationStatus } from "@prisma/client";
import prisma from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;

  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  const query = getQuery(event);
  const page = parseInt(query.page as string) || 1;
  const limit = parseInt(query.limit as string) || 10;
  const status = query.status as string | undefined;

  // Get user's applicant profile
  const profile = await prisma.applicantProfile.findUnique({
    where: { userId: auth.userId },
  });

  if (!profile) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Please complete your profile first",
    });
  }

  const where = {
    applicantId: profile.id,
    ...(status ? { status: status as DeclarationStatus } : {}),
  };

  const [declarations, total] = await Promise.all([
    prisma.declaration.findMany({
      where,
      include: {
        reviews: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        receipts: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.declaration.count({ where }),
  ]);

  return {
    success: true,
    data: {
      declarations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  };
});
