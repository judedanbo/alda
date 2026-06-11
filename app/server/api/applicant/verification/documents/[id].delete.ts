import prisma from "~/server/utils/prisma";
import { deleteFile } from "~/server/services/storage.service";
import { createAuditLog, AuditActions } from "~/server/utils/audit";

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
  if (profile.verificationStatus !== "MORE_INFO_REQUIRED") {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Documents can only be removed while more information is being requested.",
    });
  }

  await prisma.verificationDocument.delete({ where: { id: document.id } });

  // Best-effort object cleanup; the DB row is the source of truth and is
  // already gone, so a storage hiccup must not fail the request.
  try {
    await deleteFile(document.documentKey);
  } catch {
    // Orphaned objects are reclaimed out-of-band; swallow to keep delete idempotent.
  }

  await createAuditLog(event, {
    userId: auth.userId,
    action: AuditActions.VERIFICATION_DOCUMENT_DELETED,
    entityType: "verification_document",
    entityId: document.id,
    oldValues: { applicantId: profile.id, key: document.documentKey },
  });

  return { success: true, message: "Document removed" };
});
