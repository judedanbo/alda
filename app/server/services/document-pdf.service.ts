import MarkdownIt from "markdown-it";
import pdfmakeDefault from "pdfmake";
import type { Content, TableCell, TDocumentDefinitions, TFontDictionary } from "pdfmake/interfaces";
import type Token from "markdown-it/lib/token.mjs";
import { uploadBuffer } from "./storage.service";

/**
 * The package root is the server-side pdfmake singleton (an instance that
 * builds its own URL resolver). `@types/pdfmake` only types the browser
 * `createPdf` (callback-style `getBuffer`); the server document's `getBuffer`
 * returns a Promise. Narrow to the surface we actually use.
 */
interface PdfMakeServer {
  setFonts(fonts: TFontDictionary): void;
  setUrlAccessPolicy(cb: (url: string) => boolean): void;
  setLocalAccessPolicy(cb: (path: string) => boolean): void;
  createPdf(doc: TDocumentDefinitions): { getBuffer(): Promise<Buffer> };
}
const pdfmake = pdfmakeDefault as unknown as PdfMakeServer;

/**
 * Renders a completed Markdown template to a branded PDF and stores it in
 * MinIO. Mirrors the Auditor-General receipt styling in `pdf.service.ts`:
 * REPUBLIC OF GHANA / OFFICE OF THE AUDITOR-GENERAL header and the green
 * (#006B3F) palette. Every document gets a consistent cover page, a repeating
 * running header (pages ≥ 2), and a footer with `Page X of Y`.
 *
 * pdfmake is used server-side via its high-level `createPdf` with the
 * standard-14 PDF fonts (Helvetica/Courier), so no font files are shipped.
 */

const GREEN = "#006B3F";
const GRAY = "#666666";
const RULE = "#CCCCCC";
const CONTENT_WIDTH = 495; // A4 (595.28pt) minus 50pt side margins.

export interface DocumentPdfInput {
  /** Template key, used for the storage path (e.g. "dpia"). */
  key: string;
  title: string;
  versionNumber: number;
  status: string;
  owner: string;
  approver: string;
  /** Resolved Markdown (placeholders already substituted). */
  markdown: string;
  classification?: string;
}

// Standard-14 PDF fonts — embedded in pdfkit, so no font files ship with the
// build. The local-access policy below allow-lists exactly these names.
const STANDARD_FONTS = new Set([
  "Helvetica",
  "Helvetica-Bold",
  "Helvetica-Oblique",
  "Helvetica-BoldOblique",
  "Courier",
  "Courier-Bold",
  "Courier-Oblique",
  "Courier-BoldOblique",
]);

let fontsConfigured = false;
function configurePdfmake(): void {
  if (fontsConfigured) return;
  pdfmake.setFonts({
    Helvetica: {
      normal: "Helvetica",
      bold: "Helvetica-Bold",
      italics: "Helvetica-Oblique",
      bolditalics: "Helvetica-BoldOblique",
    },
    Courier: {
      normal: "Courier",
      bold: "Courier-Bold",
      italics: "Courier-Oblique",
      bolditalics: "Courier-BoldOblique",
    },
  });
  // Deny all external URL fetches and all local-file access except the
  // standard fonts — these documents never embed remote/local resources.
  pdfmake.setUrlAccessPolicy(() => false);
  pdfmake.setLocalAccessPolicy((path: string) => STANDARD_FONTS.has(path));
  fontsConfigured = true;
}

const md = new MarkdownIt({ html: false, linkify: true, breaks: false });

// ---------------------------------------------------------------------------
// Inline rendering: markdown-it inline children -> pdfmake text runs
// ---------------------------------------------------------------------------

type Run = string | { text: string; [k: string]: unknown };

function renderInline(children: Token[] | null): Content {
  if (!children || children.length === 0) return "";
  const runs: Run[] = [];
  let bold = 0;
  let italic = 0;
  let link: string | null = null;

  const push = (text: string) => {
    const run: { text: string; [k: string]: unknown } = { text };
    if (bold > 0) run.bold = true;
    if (italic > 0) run.italics = true;
    if (link) {
      run.link = link;
      run.color = "#1A5FB4";
      run.decoration = "underline";
    }
    runs.push(run.bold || run.italics || run.link ? run : text);
  };

  for (const c of children) {
    switch (c.type) {
      case "text":
        if (c.content) push(c.content);
        break;
      case "code_inline":
        runs.push({ text: c.content, style: "codeInline" });
        break;
      case "strong_open":
        bold++;
        break;
      case "strong_close":
        bold = Math.max(0, bold - 1);
        break;
      case "em_open":
        italic++;
        break;
      case "em_close":
        italic = Math.max(0, italic - 1);
        break;
      case "link_open":
        link = c.attrGet ? c.attrGet("href") : null;
        break;
      case "link_close":
        link = null;
        break;
      case "softbreak":
        runs.push(" ");
        break;
      case "hardbreak":
        runs.push("\n");
        break;
      default:
        if (c.content) push(c.content);
    }
  }

  if (runs.length === 0) return "";
  return (runs.length === 1 ? runs[0] : runs) as Content;
}

// ---------------------------------------------------------------------------
// Block rendering: token stream -> pdfmake content array
// ---------------------------------------------------------------------------

function renderList(tokens: Token[], start: number): [Content, number] {
  const ordered = tokens[start].type === "ordered_list_open";
  const items: Content[] = [];
  let i = start + 1;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t.type === "bullet_list_close" || t.type === "ordered_list_close") {
      i++;
      break;
    }
    if (t.type === "list_item_open") {
      const [nodes, ni] = renderItemBody(tokens, i + 1);
      items.push(nodes.length === 1 ? nodes[0] : { stack: nodes });
      i = ni;
    } else {
      i++;
    }
  }
  const node = ordered
    ? { ol: items, margin: [0, 2, 0, 6] as [number, number, number, number] }
    : { ul: items, margin: [0, 2, 0, 6] as [number, number, number, number] };
  return [node, i];
}

function renderItemBody(tokens: Token[], start: number): [Content[], number] {
  const nodes: Content[] = [];
  let i = start;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t.type === "list_item_close") {
      i++;
      break;
    }
    if (t.type === "paragraph_open") {
      nodes.push({ text: renderInline(tokens[i + 1]?.children ?? null) });
      i += 3;
    } else if (t.type === "bullet_list_open" || t.type === "ordered_list_open") {
      const [node, ni] = renderList(tokens, i);
      nodes.push(node);
      i = ni;
    } else if (t.type === "inline") {
      nodes.push({ text: renderInline(t.children) });
      i++;
    } else {
      i++;
    }
  }
  return [nodes, i];
}

function renderBlockquote(tokens: Token[], start: number): [Content, number] {
  let depth = 0;
  let i = start;
  const inner: Token[] = [];
  for (; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === "blockquote_open") {
      depth++;
      if (depth === 1) continue;
    }
    if (t.type === "blockquote_close") {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
    inner.push(t);
  }
  const node = {
    table: { widths: ["*"], body: [[{ stack: tokensToContent(inner), style: "quote" }]] },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: (col: number) => (col === 0 ? 3 : 0),
      vLineColor: () => GREEN,
      paddingLeft: () => 10,
      paddingRight: () => 6,
      paddingTop: () => 4,
      paddingBottom: () => 4,
    },
    margin: [0, 4, 0, 8] as [number, number, number, number],
  };
  return [node, i];
}

function renderTable(tokens: Token[], start: number): [Content, number] {
  const body: TableCell[][] = [];
  let headerRows = 0;
  let i = start + 1;
  while (i < tokens.length && tokens[i].type !== "table_close") {
    if (tokens[i].type === "tr_open") {
      const row: TableCell[] = [];
      let rowIsHeader = false;
      i++;
      while (i < tokens.length && tokens[i].type !== "tr_close") {
        const c = tokens[i];
        if (c.type === "th_open" || c.type === "td_open") {
          const isHeader = c.type === "th_open";
          if (isHeader) rowIsHeader = true;
          const inline = tokens[i + 1];
          const text = inline?.type === "inline" ? renderInline(inline.children) : "";
          row.push({
            text,
            style: isHeader ? "th" : "td",
            ...(isHeader ? { fillColor: "#E8F3EE" } : {}),
          });
          i += 3; // open, inline, close
        } else {
          i++;
        }
      }
      if (rowIsHeader) headerRows++;
      body.push(row);
      i++; // tr_close
    } else {
      i++;
    }
  }
  i++; // table_close

  const colCount = body[0]?.length ?? 1;
  const widths = new Array(colCount).fill("*");
  const node: Content = {
    table: { headerRows: headerRows || 1, widths, body },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => RULE,
      vLineColor: () => RULE,
      paddingLeft: () => 5,
      paddingRight: () => 5,
      paddingTop: () => 3,
      paddingBottom: () => 3,
    },
    margin: [0, 4, 0, 10],
  };
  return [node, i];
}

function tokensToContent(tokens: Token[]): Content[] {
  const content: Content[] = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    switch (t.type) {
      case "heading_open": {
        const level = Number(t.tag.slice(1)) || 1;
        const inline = tokens[i + 1];
        content.push({ text: renderInline(inline?.children ?? null), style: `h${Math.min(level, 4)}` });
        i += 3;
        break;
      }
      case "paragraph_open": {
        const inline = tokens[i + 1];
        content.push({ text: renderInline(inline?.children ?? null), style: "para" });
        i += 3;
        break;
      }
      case "bullet_list_open":
      case "ordered_list_open": {
        const [node, ni] = renderList(tokens, i);
        content.push(node);
        i = ni;
        break;
      }
      case "blockquote_open": {
        const [node, ni] = renderBlockquote(tokens, i);
        content.push(node);
        i = ni;
        break;
      }
      case "table_open": {
        const [node, ni] = renderTable(tokens, i);
        content.push(node);
        i = ni;
        break;
      }
      case "hr":
        content.push({
          canvas: [{ type: "line", x1: 0, y1: 3, x2: CONTENT_WIDTH, y2: 3, lineWidth: 0.5, lineColor: RULE }],
          margin: [0, 4, 0, 8],
        });
        i++;
        break;
      case "fence":
      case "code_block":
        content.push({ text: t.content.replace(/\n$/, ""), style: "code", margin: [0, 4, 0, 8] });
        i++;
        break;
      default:
        i++;
    }
  }
  return content;
}

// ---------------------------------------------------------------------------
// Cover page + document assembly
// ---------------------------------------------------------------------------

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function buildCover(input: DocumentPdfInput, classification: string): Content[] {
  const ctrlRow = (key: string, value: string): TableCell[] => [
    { text: key, style: "ctrlKey" },
    { text: value || "—", style: "ctrlVal" },
  ];
  return [
    { text: "REPUBLIC OF GHANA", style: "coverRepublic", margin: [0, 110, 0, 4] },
    { text: "OFFICE OF THE AUDITOR-GENERAL", style: "coverOffice", margin: [0, 0, 0, 2] },
    { text: "Ghana Audit Service", style: "coverSub", margin: [0, 0, 0, 36] },
    {
      canvas: [{ type: "line", x1: 0, y1: 0, x2: CONTENT_WIDTH, y2: 0, lineWidth: 2, lineColor: GREEN }],
    },
    { text: input.title, style: "coverTitle", margin: [0, 36, 0, 10] },
    {
      canvas: [{ type: "line", x1: 0, y1: 0, x2: CONTENT_WIDTH, y2: 0, lineWidth: 2, lineColor: GREEN }],
      margin: [0, 0, 0, 50],
    },
    {
      table: {
        widths: ["35%", "65%"],
        body: [
          ctrlRow("Version", `v${input.versionNumber}`),
          ctrlRow("Status", input.status),
          ctrlRow("Owner", input.owner),
          ctrlRow("Approved by", input.approver),
          ctrlRow("Date", formatDate(new Date())),
          ctrlRow("Classification", classification),
        ],
      },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => RULE,
        vLineColor: () => RULE,
        paddingLeft: () => 8,
        paddingRight: () => 8,
        paddingTop: () => 5,
        paddingBottom: () => 5,
      },
    },
    { text: "", pageBreak: "after" },
  ];
}

/** Build the pdfmake document definition (pure — no I/O). Exported for tests. */
export function buildDocDefinition(input: DocumentPdfInput): TDocumentDefinitions {
  const classification = input.classification ?? "CONFIDENTIAL — Official document of the Ghana Audit Service";
  const tokens = md.parse(input.markdown, {});
  const body = tokensToContent(tokens);

  const docDefinition: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [50, 90, 50, 70],
    info: { title: `${input.title} v${input.versionNumber}`, author: "Office of the Auditor-General" },
    content: [...buildCover(input, classification), ...body],
    header: (currentPage: number) =>
      currentPage === 1
        ? ""
        : {
            margin: [50, 24, 50, 0],
            stack: [
              {
                columns: [
                  { text: "Office of the Auditor-General", style: "runningHead", alignment: "left" },
                  { text: input.title, style: "runningHead", alignment: "right" },
                ],
              },
              {
                canvas: [{ type: "line", x1: 0, y1: 4, x2: CONTENT_WIDTH, y2: 4, lineWidth: 0.5, lineColor: GREEN }],
              },
            ],
          },
    footer: (currentPage: number, pageCount: number) => ({
      margin: [50, 8, 50, 0],
      stack: [
        { canvas: [{ type: "line", x1: 0, y1: 0, x2: CONTENT_WIDTH, y2: 0, lineWidth: 0.5, lineColor: RULE }] },
        {
          columns: [
            { text: "Official document of the Ghana Audit Service", style: "footerText", alignment: "left" },
            { text: `Page ${currentPage} of ${pageCount}`, style: "footerText", alignment: "right" },
          ],
          margin: [0, 4, 0, 0],
        },
        { text: classification, style: "footerText", alignment: "center", margin: [0, 2, 0, 0] },
      ],
    }),
    defaultStyle: { font: "Helvetica", fontSize: 10, lineHeight: 1.25, color: "#1A1A1A" },
    styles: {
      coverRepublic: { fontSize: 14, bold: true, alignment: "center", color: "#1A1A1A" },
      coverOffice: { fontSize: 18, bold: true, alignment: "center", color: GREEN },
      coverSub: { fontSize: 11, alignment: "center", color: GRAY },
      coverTitle: { fontSize: 22, bold: true, alignment: "center", color: "#1A1A1A" },
      ctrlKey: { fontSize: 10, bold: true, color: GREEN, fillColor: "#F4F8F6" },
      ctrlVal: { fontSize: 10 },
      h1: { fontSize: 17, bold: true, color: GREEN, margin: [0, 14, 0, 6] },
      h2: { fontSize: 14, bold: true, color: GREEN, margin: [0, 12, 0, 5] },
      h3: { fontSize: 12, bold: true, color: "#1A1A1A", margin: [0, 10, 0, 4] },
      h4: { fontSize: 11, bold: true, color: "#1A1A1A", margin: [0, 8, 0, 3] },
      para: { margin: [0, 2, 0, 6] },
      th: { fontSize: 8.5, bold: true, color: GREEN },
      td: { fontSize: 8.5 },
      quote: { italics: true, color: GRAY, fontSize: 9.5 },
      code: { font: "Courier", fontSize: 8.5, color: "#333333" },
      codeInline: { font: "Courier", fontSize: 9, color: "#A33" },
      runningHead: { fontSize: 8, color: GRAY },
      footerText: { fontSize: 7.5, color: GRAY },
    },
  };

  return docDefinition;
}

export async function generateDocumentPDF(input: DocumentPdfInput): Promise<string> {
  configurePdfmake();
  const docDefinition = buildDocDefinition(input);
  const buffer = await pdfmake.createPdf(docDefinition).getBuffer();

  const storageKey = `documents/${input.key}/v${input.versionNumber}.pdf`;
  return uploadBuffer(buffer, storageKey, "application/pdf");
}
