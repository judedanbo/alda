import { uploadGhanaCard, validateImageFile } from "~/server/services/storage.service";
import { createAuditLog, AuditActions } from "~/server/utils/audit";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;

  if (!auth) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  // Parse multipart form data
  const formData = await readMultipartFormData(event);

  if (!formData || formData.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "No file uploaded",
    });
  }

  const fileField = formData.find((f) => f.name === "file");
  const sideField = formData.find((f) => f.name === "side");

  if (!fileField || !fileField.data) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "File is required",
    });
  }

  const side = sideField?.data?.toString() as "front" | "back" || "front";

  if (!["front", "back"].includes(side)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Side must be 'front' or 'back'",
    });
  }

  const declaredType = fileField.type || "image/jpeg";
  const originalName = fileField.filename || "ghana-card.jpg";

  // Magic-byte validation rejects polyglots regardless of client-claimed
  // Content-Type. The returned `contentType` is the trusted one to store.
  const validation = validateImageFile(fileField.data, declaredType);
  if (!validation.valid || !validation.contentType) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: validation.error,
    });
  }

  // Upload to MinIO using the sniffed content-type, never the client claim.
  const result = await uploadGhanaCard(
    fileField.data,
    originalName,
    validation.contentType,
    auth.userId,
    side
  );

  // Record the upload. Only the storage key + content-type are logged — never
  // the file bytes. The key is scrubbed by scrubAuditValues before persisting.
  await createAuditLog(event, {
    userId: auth.userId,
    action: AuditActions.GHANA_CARD_UPLOADED,
    entityType: "applicant_profile",
    entityId: auth.userId,
    newValues: { key: result.key, side, contentType: validation.contentType },
  });

  return {
    success: true,
    message: `Ghana Card ${side} uploaded successfully`,
    data: {
      // `key` is the durable identifier — persist this in the profile.
      // `url` is a short-lived presigned URL for immediate preview only.
      key: result.key,
      url: result.url,
      side,
    },
  };
});
