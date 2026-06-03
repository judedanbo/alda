import prisma from "~/server/utils/prisma";
import { logAction, AuditActions } from "~/server/utils/audit";
import { validateBody, createDocumentVersionSchema } from "~/server/utils/validators";
import { applyFieldValues, summarizeCoverMeta } from "~/server/utils/document-template";
import { generateDocumentPDF } from "~/server/services/document-pdf.service";
import { presignStored } from "~/server/services/storage.service";

/**
 * Create a new version of a document template: substitute the entered values
 * into the Markdown, render a branded PDF, store it, and record an immutable,
 * numbered version. Admin-only (enforced by middleware).
 */
export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Template id is required" });
  }

  const template = await prisma.documentTemplate.findUnique({ where: { id } });
  if (!template) {
    throw createError({ statusCode: 404, statusMessage: "Template not found" });
  }

  const { fieldValues, status } = await validateBody(event, createDocumentVersionSchema);

  // Resolve the Markdown and cover metadata from the entered values.
  const filledMarkdown = applyFieldValues(template.sourceMarkdown, fieldValues);
  const cover = summarizeCoverMeta(template.sourceMarkdown, fieldValues);

  // Next version number for this template.
  const last = await prisma.documentVersion.findFirst({
    where: { templateId: template.id },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true },
  });
  const versionNumber = (last?.versionNumber ?? 0) + 1;

  const pdfKey = await generateDocumentPDF({
    key: template.key,
    title: template.title,
    versionNumber,
    status: cover.status || (status === "DRAFT" ? "Draft" : "Published"),
    owner: cover.owner,
    approver: cover.approver,
    markdown: filledMarkdown,
  });

  const version = await prisma.documentVersion.create({
    data: {
      templateId: template.id,
      versionNumber,
      status,
      fieldValues,
      filledMarkdown,
      pdfKey,
      createdBy: auth.userId,
    },
  });

  await logAction({
    userId: auth.userId,
    action: AuditActions.DOCUMENT_VERSION_CREATED,
    entityType: "DocumentVersion",
    entityId: version.id,
    newValues: {
      templateKey: template.key,
      versionNumber,
      status,
      fieldCount: Object.keys(fieldValues).length,
    },
    event,
  });

  const previewUrl = await presignStored(pdfKey);

  return {
    success: true,
    message: `Version ${versionNumber} created`,
    data: {
      id: version.id,
      versionNumber,
      status: version.status,
      createdAt: version.createdAt,
      url: previewUrl,
    },
  };
});
