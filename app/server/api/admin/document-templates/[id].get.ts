import prisma from "~/server/utils/prisma";
import { extractTbdFields } from "~/server/utils/document-template";

/**
 * Get a single document template: its parsed `[TBD]` fields (the interactive
 * form), plus the list of generated versions. Pass `?fromVersion=<n>` to
 * prefill field values from a previously created version.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Template id is required" });
  }

  const template = await prisma.documentTemplate.findUnique({
    where: { id },
    include: {
      versions: {
        orderBy: { versionNumber: "desc" },
        select: {
          id: true,
          versionNumber: true,
          status: true,
          createdAt: true,
          createdBy: true,
          pdfKey: true,
          creator: { select: { email: true } },
        },
      },
    },
  });

  if (!template) {
    throw createError({ statusCode: 404, statusMessage: "Template not found" });
  }

  const fields = extractTbdFields(template.sourceMarkdown);

  // Optionally prefill from a prior version's stored field values.
  const fromVersion = Number(getQuery(event).fromVersion);
  let prefill: Record<string, string> = {};
  if (Number.isFinite(fromVersion) && fromVersion > 0) {
    const prior = await prisma.documentVersion.findUnique({
      where: { templateId_versionNumber: { templateId: template.id, versionNumber: fromVersion } },
      select: { fieldValues: true },
    });
    if (prior?.fieldValues && typeof prior.fieldValues === "object") {
      prefill = prior.fieldValues as Record<string, string>;
    }
  }

  return {
    success: true,
    data: {
      template: {
        id: template.id,
        key: template.key,
        title: template.title,
        category: template.category,
      },
      fields: fields.map((f) => ({
        id: f.id,
        label: f.label,
        section: f.section,
        context: f.context,
        recommendation: f.recommendation,
        value: prefill[f.id] ?? "",
      })),
      versions: template.versions.map((v) => ({
        id: v.id,
        versionNumber: v.versionNumber,
        status: v.status,
        createdAt: v.createdAt,
        createdByEmail: v.creator?.email ?? null,
        hasPdf: Boolean(v.pdfKey),
      })),
    },
  };
});
