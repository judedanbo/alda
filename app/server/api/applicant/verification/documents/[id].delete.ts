import prisma from "~/server/utils/prisma";
import { deleteFile } from "~/server/services/storage.service";
import { logAudit, AuditActions } from "~/server/utils/audit";
import { canManageVerificationDocuments } from "~/server/utils/verification";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const id = getRouterParam(event, "id");

  const profile = await prisma.applicantProfile.findUnique({
    where: { userId: auth.userId },
    select: { id: true, verificationStatus: true },
  });

  if (!profile) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Profile not found.",
    });
  }

  const document = await prisma.verificationDocument.findUnique({
    where: { id },
    select: { id: true, applicantId: true, documentKey: true },
  });

  // Scope strictly to the caller's own profile — never reveal or touch
  // another applicant's documents.
  if (!document || document.applicantId !== profile.id) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Document not found.",
    });
  }

  // Only allow removal while a request for information is still outstanding, so
  // documents already shown to a reviewer can't be pulled out from under them.
  if (!canManageVerificationDocuments(profile.verificationStatus)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Documents can only be removed while more information is being requested.",
    });
  }

  // Object-first so a storage failure can't leave an orphan: object deletion is
  // idempotent (a missing object is a no-op), so on success — or if it was
  // already gone — we then drop the row. A real storage error aborts before the
  // row is removed, leaving the record intact for a retry.
  try {
    await deleteFile(document.documentKey);
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: "Bad Gateway",
      message: "Could not remove the stored file right now. Please try again.",
    });
  }

  await prisma.verificationDocument.delete({ where: { id: document.id } });

  logAudit(event, {
    userId: auth.userId,
    action: AuditActions.VERIFICATION_DOCUMENT_DELETED,
    entityType: "verification_document",
    entityId: document.id,
    // entityId already maps to the stored key via the DB row.
    oldValues: { applicantId: profile.id },
  });

  return { success: true, message: "Document removed" };
});
