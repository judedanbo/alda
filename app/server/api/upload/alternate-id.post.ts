import { IdDocumentType } from "@prisma/client";
import { uploadAlternateIdScan, validateImageFile } from "~/server/services/storage.service";

const VALID_TYPES = new Set<string>(Object.values(IdDocumentType));

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;

  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
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
  const typeField = formData.find((f) => f.name === "idType");

  if (!fileField || !fileField.data) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "File is required",
    });
  }

  const idType = typeField?.data?.toString() ?? "";
  if (!VALID_TYPES.has(idType) || idType === IdDocumentType.GHANA_CARD) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "idType must be one of: PASSPORT, VOTER_ID, DRIVERS_LICENSE, NIA_RECEIPT",
    });
  }

  const contentType = fileField.type || "image/jpeg";
  const originalName = fileField.filename || "alternate-id.jpg";

  const validation = validateImageFile(contentType, fileField.data.length);
  if (!validation.valid) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: validation.error,
    });
  }

  const result = await uploadAlternateIdScan(
    fileField.data,
    originalName,
    contentType,
    auth.userId,
    idType,
  );

  return {
    success: true,
    message: "Alternate ID scan uploaded successfully",
    data: {
      // `key` is the durable identifier — persist this in the profile.
      // `url` is a short-lived presigned URL for immediate preview only.
      key: result.key,
      url: result.url,
      idType,
    },
  };
});
