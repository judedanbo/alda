import prisma from "~/server/utils/prisma";
import { logAction, AuditActions } from "~/server/utils/audit";
import { presignStored } from "~/server/services/storage.service";

/**
 * Return a fresh presigned URL for a generated version's PDF (the private
 * bucket is never publicly readable). The download is audit-logged.
 */
export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  const id = getRouterParam(event, "id");
  const versionId = getRouterParam(event, "versionId");
  if (!id || !versionId) {
    throw createError({ statusCode: 400, statusMessage: "Template and version id are required" });
  }

  const version = await prisma.documentVersion.findFirst({
    where: { id: versionId, templateId: id },
    select: { id: true, versionNumber: true, pdfKey: true, template: { select: { key: true } } },
  });

  if (!version) {
    throw createError({ statusCode: 404, statusMessage: "Version not found" });
  }
  if (!version.pdfKey) {
    throw createError({ statusCode: 409, statusMessage: "This version has no generated PDF" });
  }

  const url = await presignStored(version.pdfKey);

  await logAction({
    userId: auth?.userId,
    action: AuditActions.DOCUMENT_DOWNLOADED,
    entityType: "DocumentVersion",
    entityId: version.id,
    newValues: { templateKey: version.template.key, versionNumber: version.versionNumber },
    event,
  });

  return { success: true, data: { url } };
});
