import prisma from "~/server/utils/prisma";
import { uploadVerificationDocument, validateDocumentFile, deleteFile } from "~/server/services/storage.service";
import { logAudit, AuditActions } from "~/server/utils/audit";
import { canManageVerificationDocuments } from "~/server/utils/verification";
import {
  MAX_VERIFICATION_DOCUMENTS,
  MAX_VERIFICATION_DOCUMENT_NOTE_LENGTH,
} from "~/shared/verification";

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
  if (!canManageVerificationDocuments(profile.verificationStatus)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message:
        "You can only upload documents when the legal office has requested more information.",
    });
  }

  // Fast-fail the common (sequential) over-limit case before reading the body
  // and uploading. The hard guarantee is enforced under a row lock below.
  const existingCount = await prisma.verificationDocument.count({
    where: { applicantId: profile.id },
  });
  if (existingCount >= MAX_VERIFICATION_DOCUMENTS) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: `You can attach at most ${MAX_VERIFICATION_DOCUMENTS} documents. Remove one before uploading another.`,
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
  if (note && note.length > MAX_VERIFICATION_DOCUMENT_NOTE_LENGTH) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: `Note must be ${MAX_VERIFICATION_DOCUMENT_NOTE_LENGTH} characters or fewer.`,
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
  // Capture the narrowed type — the narrowing from the guard above is not
  // preserved inside the transaction closure below.
  const contentType = validation.contentType;

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
    contentType,
    auth.userId,
  );

  // Enforce the cap atomically: a row lock on the applicant serialises
  // concurrent uploads so the count→create can't be raced past the limit.
  // Any failure (over-limit or otherwise) cleans up the just-uploaded object
  // so a rejected request never leaves an orphan in storage.
  let document;
  try {
    document = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM applicant_profiles WHERE id = ${profile.id}::uuid FOR UPDATE`;

      const count = await tx.verificationDocument.count({
        where: { applicantId: profile.id },
      });
      if (count >= MAX_VERIFICATION_DOCUMENTS) {
        throw createError({
          statusCode: 400,
          statusMessage: "Bad Request",
          message: `You can attach at most ${MAX_VERIFICATION_DOCUMENTS} documents. Remove one before uploading another.`,
        });
      }

      return tx.verificationDocument.create({
        data: {
          applicantId: profile.id,
          reviewId: latestRequest?.id ?? null,
          uploadedById: auth.userId,
          documentKey: result.key,
          fileName: originalName.slice(0, 255),
          contentType,
          size: result.size,
          note,
        },
      });
    });
  } catch (e) {
    await deleteFile(result.key).catch(() => {
      // Object cleanup is best-effort; the create already failed and is the
      // source of truth, so a storage hiccup must not mask the real error.
    });
    throw e;
  }

  logAudit(event, {
    userId: auth.userId,
    action: AuditActions.VERIFICATION_DOCUMENT_UPLOADED,
    entityType: "verification_document",
    entityId: document.id,
    // entityId already maps to the stored key via the DB row; don't duplicate
    // the bucket path into the audit values.
    newValues: {
      applicantId: profile.id,
      contentType,
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
