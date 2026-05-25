import { uploadGhanaCard, validateImageFile } from "~/server/services/storage.service";

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

  const contentType = fileField.type || "image/jpeg";
  const originalName = fileField.filename || "ghana-card.jpg";

  // Validate file
  const validation = validateImageFile(contentType, fileField.data.length);
  if (!validation.valid) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: validation.error,
    });
  }

  // Upload to MinIO
  const result = await uploadGhanaCard(
    fileField.data,
    originalName,
    contentType,
    auth.userId,
    side
  );

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
