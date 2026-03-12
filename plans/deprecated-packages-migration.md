# Deprecated Packages Migration Plan

## Overview

This document outlines the deprecated npm packages in the ADLA project and provides recommendations for their replacement with modern, actively maintained alternatives.

---

## Summary of Deprecated Packages

| Deprecated Package | Version | Root Cause | Status |
|-------------------|---------|------------|--------|
| inflight | 1.0.6 | bcrypt → @mapbox/node-pre-gyp | Transitive |
| npmlog | 5.0.1 | bcrypt → @mapbox/node-pre-gyp | Transitive |
| rimraf | 3.0.2 | bcrypt → @mapbox/node-pre-gyp | Transitive |
| glob | 7.2.3 | bcrypt → @mapbox/node-pre-gyp | Transitive |
| are-we-there-yet | 2.0.0 | bcrypt → @mapbox/node-pre-gyp → npmlog | Transitive |
| gauge | 3.0.2 | bcrypt → @mapbox/node-pre-gyp → npmlog | Transitive |
| jpeg-exif | 1.1.4 | pdfkit | Transitive |
| @oxc-parser/wasm | 0.50.0 | shadcn-nuxt@1.x | Transitive |

---

## Dependency Analysis

### 1. bcrypt (Direct Dependency)

**Problem:** `bcrypt` uses `@mapbox/node-pre-gyp` for native binary distribution, which pulls in 6 deprecated packages.

**Dependency Chain:**
```
bcrypt@5.1.1
└── @mapbox/node-pre-gyp@1.0.11
    ├── npmlog@5.0.1 (deprecated)
    │   ├── are-we-there-yet@2.0.0 (deprecated)
    │   └── gauge@3.0.2 (deprecated)
    └── rimraf@3.0.2 (deprecated)
        └── glob@7.2.3 (deprecated)
            └── inflight@1.0.6 (deprecated)
```

**Recommended Alternatives:**

| Alternative | Type | Pros | Cons |
|-------------|------|------|------|
| **bcryptjs** | Pure JS | Zero native deps, no deprecated packages, drop-in replacement | ~30% slower than native bcrypt |
| **@node-rs/bcrypt** | Rust Native | Fast, modern toolchain, no deprecated deps | Newer, smaller community |
| **argon2** | Native | More secure algorithm, OWASP recommended | Different API, requires migration |

**Recommendation:** Use `bcryptjs` for immediate fix (drop-in replacement), or migrate to `argon2` for better security long-term.

### 2. pdfkit (Direct Dependency)

**Problem:** `pdfkit` depends on `jpeg-exif@1.1.4` which is deprecated.

**Dependency Chain:**
```
pdfkit@0.16.0
└── jpeg-exif@1.1.4 (deprecated)
```

**Recommended Alternatives:**

| Alternative | Type | Pros | Cons |
|-------------|------|------|------|
| **pdf-lib** | Pure JS | No deprecated deps, works in browser, actively maintained | Different API |
| **@pdfme/generator** | TypeScript | Modern, template-based, actively maintained | Different paradigm |
| **jspdf** | Pure JS | Popular, well-documented | Less feature-rich |

**Recommendation:** Migrate to `pdf-lib` for server-side PDF generation. It's pure JavaScript, has no deprecated dependencies, and is actively maintained.

### 3. shadcn-nuxt (Dev Dependency)

**Problem:** `shadcn-nuxt@1.x` uses deprecated `@oxc-parser/wasm`.

**Dependency Chain:**
```
shadcn-nuxt@1.0.3
└── @oxc-parser/wasm@0.50.0 (deprecated)
```

**Solution:** Update to `shadcn-nuxt@2.4.3` which uses `oxc-parser@0.102.0` (not deprecated).

---

## Detailed Migration Plan

### Phase 1: Quick Wins (Low Risk)

#### 1.1 Update shadcn-nuxt

**Command:**
```bash
npm install shadcn-nuxt@^2.4.3 --save-dev
```

**Changes Required:** None (backward compatible)

**Risk Level:** Low

---

### Phase 2: bcrypt Replacement (Low Risk)

#### Replace bcrypt with bcryptjs (Drop-in Replacement)

The bcryptjs library has an identical API to bcrypt, making this a straightforward replacement.

**Step 1: Update dependencies**
```bash
npm uninstall bcrypt @types/bcrypt
npm install bcryptjs
```

**Step 2: Update imports in affected files**

The following 4 files need import changes only:

##### File: `server/api/auth/register.post.ts` (line 1)
```typescript
// Before
import bcrypt from "bcrypt";

// After
import bcrypt from "bcryptjs";
```

##### File: `server/api/auth/login.post.ts` (line 1)
```typescript
// Before
import bcrypt from "bcrypt";

// After
import bcrypt from "bcryptjs";
```

##### File: `server/api/auth/reset-password.post.ts` (line 1)
```typescript
// Before
import bcrypt from "bcrypt";

// After
import bcrypt from "bcryptjs";
```

##### File: `prisma/seed.ts` (line 2)
```typescript
// Before
import bcrypt from "bcrypt";

// After
import bcrypt from "bcryptjs";
```

**Usage remains identical:**
- `bcrypt.hash(password, 12)` - works the same
- `bcrypt.compare(password, hash)` - works the same

**Step 3: Update Dockerfiles (if needed)**

bcryptjs is pure JavaScript, so native build dependencies can be removed from Dockerfiles:

##### File: `docker/Dockerfile` (line 7)
```dockerfile
# Before
RUN apk add --no-cache python3 make g++ libc6-compat

# After (remove python3, make, g++ - only keep libc6-compat for Prisma)
RUN apk add --no-cache libc6-compat
```

##### File: `docker/Dockerfile.dev` (line 7)
```dockerfile
# Before
RUN apk add --no-cache python3 make g++ libc6-compat

# After (same as above)
RUN apk add --no-cache libc6-compat
```

**Risk Level:** Low (API is 100% compatible)

---

### Phase 3: PDF Library Replacement (Medium Risk)

#### Replace pdfkit with pdf-lib

The pdf-lib library has a completely different API from pdfkit, requiring a full rewrite of the PDF service.

**Step 1: Update dependencies**
```bash
npm uninstall pdfkit @types/pdfkit
npm install pdf-lib
```

**Step 2: Rewrite PDF service**

##### Complete Replacement for: `server/services/pdf.service.ts`

```typescript
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { uploadBuffer } from "./storage.service";

interface ReceiptData {
  receiptNumber: string;
  declarationCode: string;
  applicantName: string;
  ghanaCardNumber: string;
  institution: string;
  designation: string;
  officeCategory: string;
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
  page.drawText("REPUBLIC OF GHANA", {
    x: margin,
    y,
    size: 12,
    font: helveticaBold,
    color: blackColor,
  });
  // Center the text manually
  const republicWidth = helveticaBold.widthOfTextAtSize("REPUBLIC OF GHANA", 12);
  page.drawText("REPUBLIC OF GHANA", {
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
    { label: "Ghana Card Number:", value: data.ghanaCardNumber },
    { label: "Institution:", value: data.institution },
    { label: "Designation:", value: data.designation },
    { label: "Public Office Category:", value: data.officeCategory },
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
  const fileName = `receipts/${data.receiptNumber}.pdf`;
  const url = await uploadBuffer(pdfBuffer, fileName, "application/pdf");

  return url;
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
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  const sequence = Date.now().toString().slice(-6);
  return `RCP-${year}-${sequence}-${random}`;
}
```

**Key API Differences:**

| Feature | pdfkit | pdf-lib |
|---------|--------|---------|
| Document creation | `new PDFDocument()` | `await PDFDocument.create()` |
| Add page | Automatic first page | `doc.addPage([width, height])` |
| Text | `doc.text("text", { align })` | `page.drawText("text", { x, y })` |
| Fonts | `doc.font("Helvetica")` | `await doc.embedFont(StandardFonts.Helvetica)` |
| Colors | `doc.fillColor("#006B3F")` | `rgb(0, 0.42, 0.24)` |
| Rectangles | `doc.rect(x, y, w, h).fill()` | `page.drawRectangle({ x, y, width, height, color })` |
| Circles | `doc.circle(x, y, r).stroke()` | `page.drawCircle({ x, y, size, borderColor })` |
| Lines | `doc.moveTo().lineTo().stroke()` | `page.drawLine({ start, end })` |
| Output | Stream-based with events | `await doc.save()` returns bytes |

**Risk Level:** Medium (requires thorough testing of PDF output)

---

## Implementation Priority

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| 1 | Update shadcn-nuxt to 2.4.3 | Low | Removes 1 deprecated package |
| 2 | Replace bcrypt with bcryptjs | Low | Removes 6 deprecated packages |
| 3 | Replace pdfkit with pdf-lib | Medium | Removes 1 deprecated package |
| 4 | (Optional) Migrate to argon2 | High | Security improvement |

---

## Verification Steps

After each migration:

1. Run `npm install` and verify no deprecation warnings
2. Run `npm audit` to check for vulnerabilities
3. Run `npm run build` to verify build succeeds
4. Run tests to verify functionality
5. Test affected features manually:
   - **bcryptjs:** Test login, registration, password reset
   - **pdf-lib:** Generate a test receipt and verify PDF renders correctly
   - **shadcn-nuxt:** Verify all UI components still work

---

## Post-Migration package.json

```json
{
  "dependencies": {
    "@prisma/client": "^6.2.0",
    "@vueuse/core": "^12.5.0",
    "bcryptjs": "^3.0.3",
    "jsonwebtoken": "^9.0.2",
    "minio": "^8.0.2",
    "nodemailer": "^7.0.12",
    "nuxt": "^4.2.0",
    "pdf-lib": "^1.17.1",
    "pinia": "^3.0.4",
    "vue": "^3.5.13",
    "vue-router": "^4.5.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@nuxt/devtools": "^2.0.0",
    "@nuxt/eslint": "^1.0.0",
    "@pinia/nuxt": "^0.11.3",
    "@tailwindcss/vite": "^4.1.0",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/node": "^22.10.0",
    "@types/nodemailer": "^6.4.17",
    "eslint": "^9.18.0",
    "prisma": "^6.2.0",
    "shadcn-nuxt": "^2.4.3",
    "tailwindcss": "^4.1.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

---

## Summary of File Changes

### Files to Modify (bcrypt → bcryptjs)

| File | Line | Change |
|------|------|--------|
| `server/api/auth/register.post.ts` | 1 | Change import |
| `server/api/auth/login.post.ts` | 1 | Change import |
| `server/api/auth/reset-password.post.ts` | 1 | Change import |
| `prisma/seed.ts` | 2 | Change import |

### Files to Rewrite (pdfkit → pdf-lib)

| File | Action |
|------|--------|
| `server/services/pdf.service.ts` | Complete rewrite (see code above) |

### Files to Update (Dockerfiles)

| File | Line | Change |
|------|------|--------|
| `docker/Dockerfile` | 7 | Remove python3, make, g++ |
| `docker/Dockerfile.dev` | 7 | Remove python3, make, g++ |

---

## Notes

- All deprecated packages are **transitive dependencies** (not directly used by our code)
- The deprecation warnings don't affect functionality but indicate unmaintained code
- Replacing direct dependencies will automatically remove the deprecated transitive packages
- Consider setting up `npm-check-updates` or Dependabot for ongoing maintenance
- The bcryptjs migration is a drop-in replacement with zero code changes beyond imports
- The pdf-lib migration requires more effort but provides a cleaner, promise-based API
