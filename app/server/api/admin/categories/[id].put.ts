import { z } from "zod";
import prisma from "~/server/utils/prisma";
import { logAction, AuditActions } from "~/server/utils/audit";

const updateCategorySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(255).optional(),
  description: z.string().max(500).optional().nullable(),
  articleReference: z.string().max(50).optional().nullable(),
  isActive: z.boolean().optional(),
});

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;

  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  const idParam = getRouterParam(event, "id");
  const id = Number(idParam);

  if (!idParam || isNaN(id)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Valid category ID is required",
    });
  }

  const body = await readBody(event);
  const parsed = updateCategorySchema.safeParse(body);

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message || "Validation failed",
    });
  }

  const data = parsed.data;

  const existing = await prisma.publicOfficeCategory.findUnique({
    where: { id },
  });

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: "Category not found",
    });
  }

  // Check for duplicate name if name is being updated
  if (data.name) {
    const duplicate = await prisma.publicOfficeCategory.findFirst({
      where: {
        name: { equals: data.name.trim(), mode: "insensitive" },
        id: { not: id },
      },
    });

    if (duplicate) {
      throw createError({
        statusCode: 400,
        statusMessage: "A category with this name already exists",
      });
    }
  }

  const category = await prisma.publicOfficeCategory.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.description !== undefined && { description: data.description || null }),
      ...(data.articleReference !== undefined && { articleReference: data.articleReference || null }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });

  await logAction({
    userId: auth.userId,
    action: AuditActions.CATEGORY_UPDATED,
    entityType: "PublicOfficeCategory",
    entityId: String(id),
    oldValues: {
      name: existing.name,
      description: existing.description,
      articleReference: existing.articleReference,
      isActive: existing.isActive,
    },
    newValues: {
      name: category.name,
      description: category.description,
      articleReference: category.articleReference,
      isActive: category.isActive,
    },
    event,
  });

  return {
    success: true,
    message: "Category updated successfully",
    data: category,
  };
});
