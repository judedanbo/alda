import { randomBytes } from "node:crypto";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { uploadBuffer } from "./storage.service";

interface OfficeEntry {
  designation: string;
  institution: string;
  officeCategory: string;
}

interface ReceiptData {
  receiptNumber: string;
  declarationCode: string;
  applicantName: string;
  idLabel: string;
  idNumber: string;
  offices: OfficeEntry[];
  submissionDate: Date;
  approvalDate: Date;
  approvedBy: string;
  sealNumber?: string;
}

export async function generateReceiptPDF(data: ReceiptData): Promise<string> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4 size in points
  const { width, height } = page.getSize();

  // Embed fonts
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Colors
  const greenColor = rgb(0, 0.42, 0.24); // #006B3F
  const blackColor = rgb(0, 0, 0);
  const grayColor = rgb(0.4, 0.4, 0.4);
  const whiteColor = rgb(1, 1, 1);

  const margin = 50;
  let y = height - margin;

  // Header - Ghana Coat of Arms placeholder
  y -= 12;
  const republicText = "REPUBLIC OF GHANA";
  const republicWidth = helveticaBold.widthOfTextAtSize(republicText, 12);
  page.drawText(republicText, {
    x: (width - republicWidth) / 2,
    y,
    size: 12,
    font: helveticaBold,
    color: blackColor,
  });

  y -= 25;
  const officeText = "OFFICE OF THE AUDITOR-GENERAL";
  const officeWidth = helveticaBold.widthOfTextAtSize(officeText, 16);
  page.drawText(officeText, {
    x: (width - officeWidth) / 2,
    y,
    size: 16,
    font: helveticaBold,
    color: blackColor,
  });

  y -= 18;
  const gasText = "Ghana Audit Service";
  const gasWidth = helvetica.widthOfTextAtSize(gasText, 11);
  page.drawText(gasText, {
    x: (width - gasWidth) / 2,
    y,
    size: 11,
    font: helvetica,
    color: blackColor,
  });

  y -= 40;
  const titleText = "ASSET DECLARATION RECEIPT";
  const titleWidth = helveticaBold.widthOfTextAtSize(titleText, 18);
  page.drawText(titleText, {
    x: (width - titleWidth) / 2,
    y,
    size: 18,
    font: helveticaBold,
    color: blackColor,
  });

  y -= 18;
  const articleText = "(Pursuant to Article 286(5) of the 1992 Constitution)";
  const articleWidth = helvetica.widthOfTextAtSize(articleText, 10);
  page.drawText(articleText, {
    x: (width - articleWidth) / 2,
    y,
    size: 10,
    font: helvetica,
    color: blackColor,
  });

  y -= 40;

  // Receipt Details Box (green header)
  const boxWidth = width - 2 * margin;
  const boxHeight = 25;
  page.drawRectangle({
    x: margin,
    y: y - boxHeight,
    width: boxWidth,
    height: boxHeight,
    color: greenColor,
  });

  page.drawText(`Receipt No: ${data.receiptNumber}`, {
    x: margin + 10,
    y: y - 17,
    size: 12,
    font: helveticaBold,
    color: whiteColor,
  });

  y -= 55;

  // Details Section
  const labelX = margin + 10;
  const valueX = margin + 170;
  const lineHeight = 25;

  const details = [
    { label: "Declaration Code:", value: data.declarationCode },
    { label: "Full Name:", value: data.applicantName },
    { label: `${data.idLabel} Number:`, value: data.idNumber },
    { label: "Submission Date:", value: formatDate(data.submissionDate) },
    { label: "Approval Date:", value: formatDate(data.approvalDate) },
  ];

  for (const detail of details) {
    page.drawText(detail.label, {
      x: labelX,
      y,
      size: 11,
      font: helveticaBold,
      color: blackColor,
    });

    page.drawText(detail.value, {
      x: valueX,
      y,
      size: 11,
      font: helvetica,
      color: blackColor,
    });

    y -= lineHeight;
  }

  // Offices section
  y -= 10;
  page.drawText("Public Office(s) Held:", {
    x: labelX,
    y,
    size: 11,
    font: helveticaBold,
    color: blackColor,
  });
  y -= lineHeight;

  for (const office of data.offices) {
    page.drawText(`${office.designation}`, {
      x: labelX + 10,
      y,
      size: 10,
      font: helveticaBold,
      color: blackColor,
    });
    y -= 16;

    page.drawText(`${office.officeCategory}${office.institution ? ` — ${office.institution}` : ""}`, {
      x: labelX + 10,
      y,
      size: 10,
      font: helvetica,
      color: grayColor,
    });
    y -= lineHeight;
  }

  y -= 20;

  // Certification Statement
  const certText =
    "This is to certify that the above-named person has duly submitted their Asset Declaration " +
    "as required under Article 286(5) of the 1992 Constitution of the Republic of Ghana.";

  // Simple text wrapping
  const maxWidth = boxWidth;
  const words = certText.split(" ");
  let currentLine = "";
  const lines: string[] = [];

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = helvetica.widthOfTextAtSize(testLine, 11);
    if (testWidth > maxWidth) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  for (const line of lines) {
    page.drawText(line, {
      x: margin,
      y,
      size: 11,
      font: helvetica,
      color: blackColor,
    });
    y -= 16;
  }

  y -= 20;

  // Seal placeholder
  if (data.sealNumber) {
    const sealX = width - margin - 80;
    const sealY = y - 30;
    const sealRadius = 40;

    page.drawCircle({
      x: sealX,
      y: sealY,
      size: sealRadius,
      borderColor: greenColor,
      borderWidth: 2,
    });

    const officialText = "OFFICIAL";
    const officialWidth = helveticaBold.widthOfTextAtSize(officialText, 8);
    page.drawText(officialText, {
      x: sealX - officialWidth / 2,
      y: sealY + 5,
      size: 8,
      font: helveticaBold,
      color: greenColor,
    });

    const sealText = "SEAL";
    const sealTextWidth = helveticaBold.widthOfTextAtSize(sealText, 8);
    page.drawText(sealText, {
      x: sealX - sealTextWidth / 2,
      y: sealY - 8,
      size: 8,
      font: helveticaBold,
      color: greenColor,
    });

    y -= 80;
  }

  y -= 40;

  // Signature Section
  page.drawText("Approved By:", {
    x: margin + 10,
    y,
    size: 10,
    font: helvetica,
    color: blackColor,
  });

  // Signature line
  y -= 30;
  page.drawLine({
    start: { x: margin + 10, y },
    end: { x: margin + 200, y },
    thickness: 1,
    color: blackColor,
  });

  y -= 15;
  page.drawText(data.approvedBy, {
    x: margin + 10,
    y,
    size: 10,
    font: helveticaBold,
    color: blackColor,
  });

  y -= 15;
  page.drawText("Schedule Officer", {
    x: margin + 10,
    y,
    size: 10,
    font: helvetica,
    color: blackColor,
  });

  // Date section (right side)
  const dateX = width - margin - 150;
  page.drawText("Date:", {
    x: dateX,
    y: y + 60,
    size: 10,
    font: helvetica,
    color: blackColor,
  });

  page.drawLine({
    start: { x: dateX, y: y + 30 },
    end: { x: dateX + 140, y: y + 30 },
    thickness: 1,
    color: blackColor,
  });

  page.drawText(formatDate(data.approvalDate), {
    x: dateX,
    y: y + 15,
    size: 10,
    font: helvetica,
    color: blackColor,
  });

  // Footer
  const footerY = margin + 50;
  const footer1 = "This receipt is an official document of the Ghana Audit Service.";
  const footer1Width = helvetica.widthOfTextAtSize(footer1, 8);
  page.drawText(footer1, {
    x: (width - footer1Width) / 2,
    y: footerY,
    size: 8,
    font: helvetica,
    color: grayColor,
  });

  const footer2 = "Any alteration or forgery is a criminal offense under the laws of Ghana.";
  const footer2Width = helvetica.widthOfTextAtSize(footer2, 8);
  page.drawText(footer2, {
    x: (width - footer2Width) / 2,
    y: footerY - 12,
    size: 8,
    font: helvetica,
    color: grayColor,
  });

  const footer3 = `Generated on: ${formatDateTime(new Date())}`;
  const footer3Width = helvetica.widthOfTextAtSize(footer3, 8);
  page.drawText(footer3, {
    x: (width - footer3Width) / 2,
    y: footerY - 30,
    size: 8,
    font: helvetica,
    color: grayColor,
  });

  // Generate PDF bytes
  const pdfBytes = await doc.save();
  const pdfBuffer = Buffer.from(pdfBytes);
  const key = `receipts/${data.receiptNumber}.pdf`;
  // The bucket is private — `uploadBuffer` returns the object key, not a
  // public URL. Persist the key; re-sign with `presignStored` on read.
  return uploadBuffer(pdfBuffer, key, "application/pdf");
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateTime(date: Date): string {
  return new Date(date).toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function generateReceiptNumber(): string {
  const year = new Date().getFullYear();
  // 6 hex chars (~24 bits of entropy) of cryptographically-strong randomness
  // — replaces a Math.random() + Date.now().slice(-6) combo that an attacker
  // could approximate from the wall clock alone. The "RCP-YYYY-..." shape
  // is unchanged.
  const random = randomBytes(3).toString("hex").toUpperCase();
  const sequence = randomBytes(3).toString("hex").toUpperCase();
  return `RCP-${year}-${sequence}-${random}`;
}
