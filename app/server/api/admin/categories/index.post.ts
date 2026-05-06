import { z } from "zod";
import prisma from "~/server/utils/prisma";
import { logAction, AuditActions } from "~/server/utils/audit";

const createCategorySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(255),
  description: z.string().max(500).optional().nullable(),
  articleReference: z.string().max(50).optional().nullable(),
});

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;

  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  const body = await readBody(event);
  const parsed = createCategorySchema.safeParse(body);

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message || "Validation failed",
    });
  }

  const data = parsed.data;

  // Check for duplicate name
  const existing = await prisma.publicOfficeCategory.findFirst({
    where: { name: { equals: data.name.trim(), mode: "insensitive" } },
  });

  if (existing) {
    throw createError({
      statusCode: 400,
      statusMessage: "A category with this name already exists",
    });
  }

  const category = await prisma.publicOfficeCategory.create({
    data: {
      name: data.name.trim(),
      description: data.description || null,
      articleReference: data.articleReference || null,
    },
  });

  await logAction({
    userId: auth.userId,
    action: AuditActions.CATEGORY_CREATED,
    entityType: "PublicOfficeCategory",
    entityId: String(category.id),
    newValues: {
      name: category.name,
      description: category.description,
      articleReference: category.articleReference,
    },
    event,
  });

  return {
    success: true,
    message: "Category created successfully",
    data: category,
  };
});
