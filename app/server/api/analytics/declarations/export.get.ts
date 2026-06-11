import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import prisma from "~/server/utils/prisma";
import {
  parseFilters,
  getRoleScope,
  buildSealedHistoryWhere,
} from "~/server/utils/analytics-filters";
import { maskGhanaCard, maskAlternateId } from "~/server/utils/pii";
import { decryptProfileIds } from "~/server/utils/pii-encryption";
import { logAudit, AuditActions } from "~/server/utils/audit";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  // Export restricted to admin and schedule_officer
  const roles = auth.roles as string[];
  if (!roles.includes("admin") && !roles.includes("schedule_officer")) {
    throw createError({ statusCode: 403, statusMessage: "Export not permitted for this role" });
  }

  const query = getQuery(event);
  const format = (query.format as string) || "csv";

  if (format !== "csv" && format !== "pdf") {
    throw createError({ statusCode: 400, statusMessage: "Format must be csv or pdf" });
  }

  const filters = parseFilters(event);
  const scope = await getRoleScope(event);
  const where = buildSealedHistoryWhere(filters, scope);

  const rows = await prisma.declarationStatusHistory.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      changedBy: { select: { email: true } },
      declaration: {
        select: {
          uniqueCode: true,
          createdAt: true,
          applicant: {
            select: {
              fullName: true,
              idType: true,
              ghanaCardNumberCipher: true,
              alternateIdNumberCipher: true,
              offices: {
                select: { institution: { select: { name: true } } },
              },
            },
          },
          formCollections: {
            take: 1,
            orderBy: { createdAt: "desc" },
            select: {
              collectionOffice: { select: { name: true, region: true } },
            },
          },
          returnOffice: { select: { name: true, region: true } },
          receipts: { take: 1, select: { receiptNumber: true } },
        },
      },
    },
  });

  const items = rows.map((row) => {
    const decl = row.declaration;
    const office = decl.formCollections[0]?.collectionOffice ?? decl.returnOffice;
    const institutions = [
      ...new Set(
        decl.applicant.offices
          .map((o) => o.institution?.name)
          .filter(Boolean),
      ),
    ].join("; ");
    const days =
      Math.round(
        ((row.createdAt.getTime() - decl.createdAt.getTime()) / 86400000) * 10,
      ) / 10;

    // The ID number is masked in the export to keep this endpoint from
    // becoming a one-shot PII dump for any compromised officer/admin
    // account. Operations that genuinely need the unmasked value should
    // be handled through a separate, second-factor-gated workflow.
    const decryptedApplicant = decryptProfileIds(decl.applicant);
    const rawIdNumber
      = decl.applicant.idType === "GHANA_CARD"
        ? decryptedApplicant.ghanaCardNumber
        : decryptedApplicant.alternateIdNumber;
    const maskedIdNumber
      = decl.applicant.idType === "GHANA_CARD"
        ? maskGhanaCard(rawIdNumber)
        : maskAlternateId(rawIdNumber);

    return {
      code: decl.uniqueCode,
      applicant: decl.applicant.fullName,
      idType: decl.applicant.idType,
      idNumber: maskedIdNumber,
      institutions,
      collectionOffice: office?.name ?? "",
      region: office?.region ?? "",
      sealedAt: row.createdAt.toISOString().slice(0, 10),
      processingDays: days,
      processedBy: row.changedBy?.email?.split("@")[0] ?? "System",
      receipt: decl.receipts[0]?.receiptNumber ?? "",
    };
  });

  // Compliance: a bulk export of (masked) applicant records left the system.
  // Record the actor, format, row count and the filter window — no PII in the
  // payload (filter keys never match the PII masker registry).
  logAudit(event, {
    userId: auth.userId,
    action: AuditActions.DECLARATION_EXPORTED,
    entityType: "declaration_export",
    newValues: { format, rowCount: items.length, filters },
  });

  if (format === "csv") {
    const headers = [
      "Code",
      "Applicant",
      "ID Type",
      "ID Number",
      "Institutions",
      "Collection Office",
      "Region",
      "Sealed Date",
      "Processing Days",
      "Processed By",
      "Receipt",
    ];
    const csvRows = [
      headers.join(","),
      ...items.map((item) =>
        [
          item.code,
          `"${item.applicant}"`,
          item.idType,
          item.idNumber ?? "",
          `"${item.institutions}"`,
          `"${item.collectionOffice}"`,
          `"${item.region}"`,
          item.sealedAt,
          item.processingDays,
          item.processedBy,
          item.receipt,
        ].join(","),
      ),
    ];

    setResponseHeader(event, "Content-Type", "text/csv");
    setResponseHeader(
      event,
      "Content-Disposition",
      `attachment; filename="sealed-declarations-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    return csvRows.join("\n");
  }

  // PDF generation
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([842, 595]); // A4 landscape
  const { height } = page.getSize();
  let y = height - 40;

  page.drawText("Sealed Declarations Report", {
    x: 40,
    y,
    size: 16,
    font: boldFont,
    color: rgb(0, 0.42, 0.25),
  });
  y -= 20;
  page.drawText(
    `Generated: ${new Date().toISOString().slice(0, 10)} | Total: ${items.length} declarations`,
    { x: 40, y, size: 9, font, color: rgb(0.4, 0.4, 0.4) },
  );
  y -= 25;

  const cols = [
    { label: "Code", x: 40, w: 120 },
    { label: "Applicant", x: 160, w: 120 },
    { label: "Institution(s)", x: 280, w: 140 },
    { label: "Office", x: 420, w: 100 },
    { label: "Sealed", x: 520, w: 70 },
    { label: "Days", x: 590, w: 40 },
    { label: "Officer", x: 630, w: 80 },
    { label: "Receipt", x: 710, w: 90 },
  ];

  for (const col of cols) {
    page.drawText(col.label, {
      x: col.x,
      y,
      size: 8,
      font: boldFont,
      color: rgb(0.3, 0.3, 0.3),
    });
  }
  y -= 4;
  page.drawLine({
    start: { x: 40, y },
    end: { x: 800, y },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  });
  y -= 12;

  for (const item of items) {
    if (y < 40) {
      page = pdfDoc.addPage([842, 595]);
      y = height - 40;
    }

    const values = [
      item.code,
      item.applicant.slice(0, 20),
      item.institutions.slice(0, 25),
      item.collectionOffice.slice(0, 16),
      item.sealedAt,
      String(item.processingDays),
      item.processedBy.slice(0, 12),
      item.receipt,
    ];

    cols.forEach((col, i) => {
      page.drawText(values[i] ?? "", {
        x: col.x,
        y,
        size: 7,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
    });
    y -= 14;
  }

  const pdfBytes = await pdfDoc.save();

  setResponseHeader(event, "Content-Type", "application/pdf");
  setResponseHeader(
    event,
    "Content-Disposition",
    `attachment; filename="sealed-declarations-${new Date().toISOString().slice(0, 10)}.pdf"`,
  );
  return Buffer.from(pdfBytes);
});
