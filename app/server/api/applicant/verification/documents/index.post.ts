import prisma from "~/server/utils/prisma";
import { uploadVerificationDocument, validateDocumentFile } from "~/server/services/storage.service";
import { createAuditLog, AuditActions } from "~/server/utils/audit";

// Cap how many documents an applicant can attach to a single info request so a
// runaway client can't fill the bucket. Re-checked on every upload.
const MAX_DOCUMENTS = 10;
const MAX_NOTE_LENGTH = 1000;

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const profile = await prisma.applicantProfile.findUnique({
    where: { userId: auth.userId },
    select: { id: true, verificationStatus: true },
  });

  if (!profile) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Profile not found. Please complete your profile first.",
    });
  }

  // Documents are only meaningful as a reply to an outstanding request for
  // information. Reject otherwise so the feature can't be used to stash files.
  if (profile.verificationStatus !== "MORE_INFO_REQUIRED") {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message:
        "You can only upload documents when the legal office has requested more information.",
    });
  }

  const existingCount = await prisma.verificationDocument.count({
    where: { applicantId: profile.id },
  });
  if (existingCount >= MAX_DOCUMENTS) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: `You can attach at most ${MAX_DOCUMENTS} documents. Remove one before uploading another.`,
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
  const noteField = formData.find((f) => f.name === "note");

  if (!fileField || !fileField.data) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "File is required",
    });
  }

  const note = noteField?.data?.toString().trim() || null;
  if (note && note.length > MAX_NOTE_LENGTH) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: `Note must be ${MAX_NOTE_LENGTH} characters or fewer.`,
    });
  }

  const declaredType = fileField.type || "application/pdf";
  const originalName = fileField.filename || "document";

  // Magic-byte validation rejects polyglots regardless of the client-claimed
  // Content-Type; the returned `contentType` is the trusted one to store.
  const validation = validateDocumentFile(fileField.data, declaredType);
  if (!validation.valid || !validation.contentType) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: validation.error,
    });
  }

  // Link the upload to the request that prompted it, when one exists, so the
  // reviewer sees exactly what was supplied in reply to their message.
  const latestRequest = await prisma.applicantVerificationReview.findFirst({
    where: { applicantId: profile.id, status: "MORE_INFO_REQUIRED" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  const result = await uploadVerificationDocument(
    fileField.data,
    originalName,
    validation.contentType,
    auth.userId,
  );

  const document = await prisma.verificationDocument.create({
    data: {
      applicantId: profile.id,
      reviewId: latestRequest?.id ?? null,
      uploadedById: auth.userId,
      documentKey: result.key,
      fileName: originalName.slice(0, 255),
      contentType: validation.contentType,
      size: result.size,
      note,
    },
  });

  await createAuditLog(event, {
    userId: auth.userId,
    action: AuditActions.VERIFICATION_DOCUMENT_UPLOADED,
    entityType: "verification_document",
    entityId: document.id,
    newValues: {
      applicantId: profile.id,
      key: result.key,
      contentType: validation.contentType,
      size: result.size,
    },
  });

  return {
    success: true,
    message: "Document uploaded",
    data: {
      id: document.id,
      fileName: document.fileName,
      contentType: document.contentType,
      size: document.size,
      note: document.note,
      url: result.url,
      createdAt: document.createdAt,
    },
  };
});
