import prisma from "~/server/utils/prisma";
import { uploadFile, validateDocumentFile } from "~/server/services/storage.service";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;

  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  // This route is not under /api/legal, so role-gate it here
  const userRoles = await prisma.userRole.findMany({
    where: { userId: auth.userId },
    include: { role: true },
  });

  const allowedRoles = ["legal_unit", "admin"];
  const hasAccess = userRoles.some((ur) => allowedRoles.includes(ur.role.name));

  if (!hasAccess) {
    throw createError({
      statusCode: 403,
      statusMessage: "Access denied. Legal Unit or Admin role required.",
    });
  }

  const formData = await readMultipartFormData(event);

  if (!formData || formData.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "No file uploaded",
    });
  }

  const fileField = formData.find((f) => f.name === "file");

  if (!fileField || !fileField.data) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "File is required",
    });
  }

  const contentType = fileField.type || "application/pdf";
  const originalName = fileField.filename || "reissue-letter.pdf";

  const validation = validateDocumentFile(contentType, fileField.data.length);
  if (!validation.valid) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: validation.error,
    });
  }

  const result = await uploadFile(
    fileField.data,
    originalName,
    contentType,
    "reissue-letters"
  );

  return {
    success: true,
    message: "Reissue letter uploaded",
    data: {
      url: result.url,
      key: result.key,
    },
  };
});
