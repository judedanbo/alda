# Multiple Offices per Applicant — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow applicants to hold multiple public offices, each with start/end dates, by extracting office fields from `ApplicantProfile` into a new `ApplicantOffice` model.

**Architecture:** New `ApplicantOffice` table with FK to `ApplicantProfile`. Office CRUD via four new API endpoints. Profile create/update/read endpoints drop office fields and include the `offices` relation. UI setup step 3 and edit page become repeatable office forms.

**Tech Stack:** Prisma (PostgreSQL), Nuxt 4 / Nitro, Zod, Vue 3 + shadcn-vue, pdf-lib

---

## File Map

### New files
- `app/server/api/profile/offices/index.get.ts` — list offices
- `app/server/api/profile/offices/index.post.ts` — add office
- `app/server/api/profile/offices/[id].put.ts` — update office
- `app/server/api/profile/offices/[id].delete.ts` — remove office

### Modified files
- `app/prisma/schema.prisma` — new `ApplicantOffice` model, strip office fields from `ApplicantProfile`, update relations on `PublicOfficeCategory` and `Institution`
- `app/server/utils/validators.ts` — remove office fields from `applicantProfileSchema`, add `officeSchema`
- `app/server/utils/audit.ts` — add `OFFICE_ADDED`, `OFFICE_UPDATED`, `OFFICE_REMOVED` actions
- `app/server/api/profile/index.post.ts` — remove office fields from create
- `app/server/api/profile/index.put.ts` — remove office fields from update
- `app/server/api/profile/index.get.ts` — include `offices` relation
- `app/server/api/auth/me.get.ts` — include `offices` relation
- `app/server/api/declarations/[id].get.ts` — include `offices` via applicant
- `app/server/api/admin/declarations.get.ts` — include `offices`, update response mapping
- `app/server/api/admin/users/index.get.ts` — include `offices`, update response mapping
- `app/server/api/verify/[code].get.ts` — include `offices` via applicant
- `app/server/api/submissions/pending.get.ts` — include `offices` via applicant
- `app/server/api/reviews/pending.get.ts` — include `offices` via applicant
- `app/server/api/receipts/pending.get.ts` — include `offices` via applicant
- `app/server/api/receipts/[declarationId].post.ts` — pass active offices to PDF
- `app/server/services/pdf.service.ts` — accept offices array, render active offices
- `app/pages/applicant/profile/setup.vue` — step 3 becomes repeatable office form
- `app/pages/applicant/profile/edit.vue` — office list with add/edit/remove
- `app/pages/applicant/declaration/new.vue` — show offices list in profile summary
- `app/pages/officer/submissions.vue` — update type + display
- `app/pages/officer/reviews.vue` — update type + display
- `app/pages/officer/receipts.vue` — update type + display
- `app/pages/legal/verify.vue` — update type + display
- `app/pages/admin/users.vue` — update type + display
- `app/pages/admin/declarations.vue` — update type + display

---

## Task 1: Create branch and update Prisma schema

**Files:**
- Modify: `app/prisma/schema.prisma:112-161`

- [ ] **Step 1: Create feature branch**

```bash
git checkout -b feature/multiple-offices
```

- [ ] **Step 2: Add `ApplicantOffice` model and update `ApplicantProfile`**

In `app/prisma/schema.prisma`, replace the `ApplicantProfile` model (lines 112-132) with:

```prisma
model ApplicantProfile {
  id               String   @id @default(uuid()) @db.Uuid
  userId           String   @unique @map("user_id") @db.Uuid
  fullName         String   @map("full_name") @db.VarChar(255)
  ghanaCardNumber  String   @unique @map("ghana_card_number") @db.VarChar(20)
  ghanaCardFrontUrl String  @map("ghana_card_front_url") @db.Text
  ghanaCardBackUrl  String? @map("ghana_card_back_url") @db.Text
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  // Relations
  user         User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  offices      ApplicantOffice[]
  declarations Declaration[]

  @@map("applicant_profiles")
}

model ApplicantOffice {
  id               String    @id @default(uuid()) @db.Uuid
  profileId        String    @map("profile_id") @db.Uuid
  designation      String    @db.VarChar(255)
  officeCategoryId Int       @map("office_category_id")
  institutionId    String?   @map("institution_id") @db.Uuid
  startDate        DateTime  @map("start_date") @db.Date
  endDate          DateTime? @map("end_date") @db.Date
  createdAt        DateTime  @default(now()) @map("created_at")
  updatedAt        DateTime  @updatedAt @map("updated_at")

  profile        ApplicantProfile     @relation(fields: [profileId], references: [id], onDelete: Cascade)
  officeCategory PublicOfficeCategory @relation(fields: [officeCategoryId], references: [id])
  institution    Institution?         @relation(fields: [institutionId], references: [id])

  @@map("applicant_offices")
}
```

- [ ] **Step 3: Update `PublicOfficeCategory` relations**

Replace line 146 (`applicantProfiles ApplicantProfile[]`) with:

```prisma
  applicantOffices ApplicantOffice[]
```

- [ ] **Step 4: Update `Institution` relations**

Replace line 158 (`applicantProfiles ApplicantProfile[]`) with:

```prisma
  applicantOffices ApplicantOffice[]
```

- [ ] **Step 5: Generate migration with data migration**

```bash
cd app && npx prisma migrate dev --name add_applicant_offices --create-only
```

This creates the migration SQL without applying it. Open the generated migration file and add a data migration block **after** the `CREATE TABLE "applicant_offices"` statement and **before** the `ALTER TABLE` statements that drop the old columns:

```sql
-- Data migration: copy existing office data to new table
INSERT INTO "applicant_offices" ("id", "profile_id", "designation", "office_category_id", "institution_id", "start_date", "created_at", "updated_at")
SELECT
  gen_random_uuid(),
  "id",
  "designation",
  "office_category_id",
  "institution_id",
  "created_at",
  NOW(),
  NOW()
FROM "applicant_profiles"
WHERE "designation" IS NOT NULL AND "office_category_id" IS NOT NULL;
```

Then apply the migration:

```bash
npx prisma migrate dev
```

- [ ] **Step 6: Regenerate Prisma client**

```bash
npm run db:generate
```

- [ ] **Step 7: Commit**

```bash
git add app/prisma/
git commit -m "feat: add ApplicantOffice model and migrate data from profile"
```

---

## Task 2: Update validators and audit actions

**Files:**
- Modify: `app/server/utils/validators.ts:55-65`
- Modify: `app/server/utils/audit.ts:50-91`

- [ ] **Step 1: Update `applicantProfileSchema` — remove office fields**

In `app/server/utils/validators.ts`, replace lines 55-65 with:

```typescript
export const applicantProfileSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  ghanaCardNumber: z
    .string()
    .regex(ghanaCardRegex, "Invalid Ghana Card number format (GHA-XXXXXXXXX-X)"),
  ghanaCardFrontUrl: z.string().url("Invalid Ghana Card front image URL").optional(),
  ghanaCardBackUrl: z.string().url("Invalid Ghana Card back image URL").optional(),
});
```

- [ ] **Step 2: Add `officeSchema` after `applicantProfileSchema`**

```typescript
export const officeSchema = z.object({
  designation: z.string().min(2, "Designation is required").max(255),
  officeCategoryId: z.number().int().positive("Office category is required"),
  institutionId: z.string().uuid("Invalid institution ID").optional().nullable(),
  startDate: z.coerce.date({ required_error: "Start date is required" }),
  endDate: z.coerce.date().optional().nullable(),
}).refine(
  (data) => !data.endDate || data.endDate > data.startDate,
  { message: "End date must be after start date", path: ["endDate"] }
);
```

- [ ] **Step 3: Add audit actions for offices**

In `app/server/utils/audit.ts`, add these three entries after `PROFILE_UPDATED`:

```typescript
  OFFICE_ADDED: "office_added",
  OFFICE_UPDATED: "office_updated",
  OFFICE_REMOVED: "office_removed",
```

- [ ] **Step 4: Commit**

```bash
git add app/server/utils/validators.ts app/server/utils/audit.ts
git commit -m "feat: add office validation schema and audit actions"
```

---

## Task 3: Create office CRUD API endpoints

**Files:**
- Create: `app/server/api/profile/offices/index.get.ts`
- Create: `app/server/api/profile/offices/index.post.ts`
- Create: `app/server/api/profile/offices/[id].put.ts`
- Create: `app/server/api/profile/offices/[id].delete.ts`

- [ ] **Step 1: Create `GET /api/profile/offices`**

Create `app/server/api/profile/offices/index.get.ts`:

```typescript
import prisma from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;

  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const profile = await prisma.applicantProfile.findUnique({
    where: { userId: auth.userId },
  });

  if (!profile) {
    throw createError({
      statusCode: 404,
      message: "Profile not found. Please complete profile setup first.",
    });
  }

  const offices = await prisma.applicantOffice.findMany({
    where: { profileId: profile.id },
    include: {
      officeCategory: true,
      institution: true,
    },
    orderBy: { startDate: "desc" },
  });

  return { success: true, data: offices };
});
```

- [ ] **Step 2: Create `POST /api/profile/offices`**

Create `app/server/api/profile/offices/index.post.ts`:

```typescript
import prisma from "~/server/utils/prisma";
import { validateBody, officeSchema } from "~/server/utils/validators";
import { createAuditLog, AuditActions } from "~/server/utils/audit";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;

  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const profile = await prisma.applicantProfile.findUnique({
    where: { userId: auth.userId },
  });

  if (!profile) {
    throw createError({
      statusCode: 404,
      message: "Profile not found. Please complete profile setup first.",
    });
  }

  const data = await validateBody(event, officeSchema);

  const category = await prisma.publicOfficeCategory.findUnique({
    where: { id: data.officeCategoryId },
  });

  if (!category || !category.isActive) {
    throw createError({
      statusCode: 400,
      message: "Invalid or inactive office category",
    });
  }

  if (data.institutionId) {
    const institution = await prisma.institution.findUnique({
      where: { id: data.institutionId },
    });

    if (!institution) {
      throw createError({ statusCode: 400, message: "Invalid institution ID" });
    }
  }

  const office = await prisma.applicantOffice.create({
    data: {
      profileId: profile.id,
      designation: data.designation,
      officeCategoryId: data.officeCategoryId,
      institutionId: data.institutionId || null,
      startDate: data.startDate,
      endDate: data.endDate || null,
    },
    include: {
      officeCategory: true,
      institution: true,
    },
  });

  await createAuditLog(event, {
    userId: auth.userId,
    action: AuditActions.OFFICE_ADDED,
    entityType: "applicant_office",
    entityId: office.id,
    newValues: {
      designation: office.designation,
      officeCategoryId: office.officeCategoryId,
      startDate: office.startDate.toISOString(),
    },
  });

  return { success: true, message: "Office added successfully", data: office };
});
```

- [ ] **Step 3: Create `PUT /api/profile/offices/[id]`**

Create `app/server/api/profile/offices/[id].put.ts`:

```typescript
import prisma from "~/server/utils/prisma";
import { validateBody, officeSchema } from "~/server/utils/validators";
import { createAuditLog, AuditActions } from "~/server/utils/audit";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;

  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const officeId = getRouterParam(event, "id");

  if (!officeId) {
    throw createError({ statusCode: 400, message: "Office ID is required" });
  }

  const profile = await prisma.applicantProfile.findUnique({
    where: { userId: auth.userId },
  });

  if (!profile) {
    throw createError({ statusCode: 404, message: "Profile not found" });
  }

  const existing = await prisma.applicantOffice.findUnique({
    where: { id: officeId },
  });

  if (!existing || existing.profileId !== profile.id) {
    throw createError({ statusCode: 404, message: "Office not found" });
  }

  const data = await validateBody(event, officeSchema);

  const category = await prisma.publicOfficeCategory.findUnique({
    where: { id: data.officeCategoryId },
  });

  if (!category || !category.isActive) {
    throw createError({
      statusCode: 400,
      message: "Invalid or inactive office category",
    });
  }

  if (data.institutionId) {
    const institution = await prisma.institution.findUnique({
      where: { id: data.institutionId },
    });

    if (!institution) {
      throw createError({ statusCode: 400, message: "Invalid institution ID" });
    }
  }

  const oldValues = {
    designation: existing.designation,
    officeCategoryId: existing.officeCategoryId,
    institutionId: existing.institutionId,
    startDate: existing.startDate.toISOString(),
    endDate: existing.endDate?.toISOString() || null,
  };

  const updated = await prisma.applicantOffice.update({
    where: { id: officeId },
    data: {
      designation: data.designation,
      officeCategoryId: data.officeCategoryId,
      institutionId: data.institutionId || null,
      startDate: data.startDate,
      endDate: data.endDate || null,
    },
    include: {
      officeCategory: true,
      institution: true,
    },
  });

  await createAuditLog(event, {
    userId: auth.userId,
    action: AuditActions.OFFICE_UPDATED,
    entityType: "applicant_office",
    entityId: updated.id,
    oldValues,
    newValues: {
      designation: updated.designation,
      officeCategoryId: updated.officeCategoryId,
      institutionId: updated.institutionId,
      startDate: updated.startDate.toISOString(),
      endDate: updated.endDate?.toISOString() || null,
    },
  });

  return { success: true, message: "Office updated successfully", data: updated };
});
```

- [ ] **Step 4: Create `DELETE /api/profile/offices/[id]`**

Create `app/server/api/profile/offices/[id].delete.ts`:

```typescript
import prisma from "~/server/utils/prisma";
import { createAuditLog, AuditActions } from "~/server/utils/audit";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;

  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const officeId = getRouterParam(event, "id");

  if (!officeId) {
    throw createError({ statusCode: 400, message: "Office ID is required" });
  }

  const profile = await prisma.applicantProfile.findUnique({
    where: { userId: auth.userId },
  });

  if (!profile) {
    throw createError({ statusCode: 404, message: "Profile not found" });
  }

  const existing = await prisma.applicantOffice.findUnique({
    where: { id: officeId },
  });

  if (!existing || existing.profileId !== profile.id) {
    throw createError({ statusCode: 404, message: "Office not found" });
  }

  const officeCount = await prisma.applicantOffice.count({
    where: { profileId: profile.id },
  });

  if (officeCount <= 1) {
    throw createError({
      statusCode: 400,
      message: "Cannot remove the last office. At least one office is required.",
    });
  }

  await prisma.applicantOffice.delete({ where: { id: officeId } });

  await createAuditLog(event, {
    userId: auth.userId,
    action: AuditActions.OFFICE_REMOVED,
    entityType: "applicant_office",
    entityId: officeId,
    oldValues: {
      designation: existing.designation,
      officeCategoryId: existing.officeCategoryId,
      institutionId: existing.institutionId,
      startDate: existing.startDate.toISOString(),
      endDate: existing.endDate?.toISOString() || null,
    },
  });

  return { success: true, message: "Office removed successfully" };
});
```

- [ ] **Step 5: Commit**

```bash
git add app/server/api/profile/offices/
git commit -m "feat: add CRUD endpoints for applicant offices"
```

---

## Task 4: Update existing profile and auth endpoints

**Files:**
- Modify: `app/server/api/profile/index.post.ts`
- Modify: `app/server/api/profile/index.put.ts`
- Modify: `app/server/api/profile/index.get.ts`
- Modify: `app/server/api/auth/me.get.ts`

- [ ] **Step 1: Update `POST /api/profile` — remove office fields**

In `app/server/api/profile/index.post.ts`:

Remove the institution verification block (lines 45-57), the category verification block (lines 60-70), and update the `prisma.applicantProfile.create` call (lines 73-88) to:

```typescript
  const profile = await prisma.applicantProfile.create({
    data: {
      userId: auth.userId,
      fullName: data.fullName,
      ghanaCardNumber: data.ghanaCardNumber,
      ghanaCardFrontUrl: data.ghanaCardFrontUrl || "",
      ghanaCardBackUrl: data.ghanaCardBackUrl,
    },
    include: {
      offices: {
        include: {
          officeCategory: true,
          institution: true,
        },
      },
    },
  });
```

Also update the audit log `newValues` (line 99) to remove `designation`:

```typescript
    newValues: {
      fullName: profile.fullName,
      ghanaCardNumber: profile.ghanaCardNumber,
    },
```

- [ ] **Step 2: Update `PUT /api/profile` — remove office fields**

In `app/server/api/profile/index.put.ts`, replace the `updateProfileSchema` (lines 5-11) with:

```typescript
const updateProfileSchema = z.object({
  ghanaCardFrontUrl: z.string().url().optional(),
  ghanaCardBackUrl: z.string().url().optional(),
});
```

Remove the `oldValues` block that references `designation`, `institutionId`, `officeCategoryId` (lines 44-48). Replace with:

```typescript
  const oldValues = {
    ghanaCardFrontUrl: profile.ghanaCardFrontUrl,
    ghanaCardBackUrl: profile.ghanaCardBackUrl,
  };
```

Update the `include` in the update call (lines 53-56) to:

```typescript
    include: {
      offices: {
        include: {
          officeCategory: true,
          institution: true,
        },
      },
    },
```

- [ ] **Step 3: Update `GET /api/profile` — include offices**

In `app/server/api/profile/index.get.ts`, replace the `include` block (lines 15-18) with:

```typescript
    include: {
      offices: {
        include: {
          officeCategory: true,
          institution: true,
        },
        orderBy: { startDate: "desc" as const },
      },
    },
```

- [ ] **Step 4: Update `GET /api/auth/me` — include offices**

In `app/server/api/auth/me.get.ts`, replace the `applicantProfile` include block (lines 23-28) with:

```typescript
      applicantProfile: {
        include: {
          offices: {
            include: {
              officeCategory: true,
              institution: true,
            },
            orderBy: { startDate: "desc" as const },
          },
        },
      },
```

Update the profile response mapping (lines 49-57) to:

```typescript
      profile: user.applicantProfile
        ? {
            id: user.applicantProfile.id,
            fullName: user.applicantProfile.fullName,
            ghanaCardNumber: user.applicantProfile.ghanaCardNumber,
            offices: user.applicantProfile.offices,
          }
        : null,
```

- [ ] **Step 5: Commit**

```bash
git add app/server/api/profile/ app/server/api/auth/me.get.ts
git commit -m "feat: update profile and auth endpoints for multiple offices"
```

---

## Task 5: Update all declaration-related query endpoints

**Files:**
- Modify: `app/server/api/declarations/[id].get.ts`
- Modify: `app/server/api/admin/declarations.get.ts`
- Modify: `app/server/api/admin/users/index.get.ts`
- Modify: `app/server/api/verify/[code].get.ts`
- Modify: `app/server/api/submissions/pending.get.ts`
- Modify: `app/server/api/reviews/pending.get.ts`
- Modify: `app/server/api/receipts/pending.get.ts`

In every file listed, the Prisma query includes `applicant: { include: { institution: true, officeCategory: true } }`. Replace all such includes with:

```typescript
applicant: {
  include: {
    offices: {
      include: {
        officeCategory: true,
        institution: true,
      },
      orderBy: { startDate: "desc" as const },
    },
    // keep any other existing includes like `user` untouched
  },
},
```

The specific changes per file:

- [ ] **Step 1: Update `app/server/api/declarations/[id].get.ts`**

Lines 35-40 — replace `institution: true, officeCategory: true` with `offices` include as above. Keep the `user` select.

- [ ] **Step 2: Update `app/server/api/verify/[code].get.ts`**

Lines 44-52 — replace `institution: true, officeCategory: true` with `offices` include. Keep the `user` select.

- [ ] **Step 3: Update `app/server/api/submissions/pending.get.ts`**

Lines 50-56 — replace `institution: true, officeCategory: true` with `offices` include. Keep the `user` select.

- [ ] **Step 4: Update `app/server/api/reviews/pending.get.ts`**

Lines 50-56 — replace `institution: true, officeCategory: true` with `offices` include. Keep the `user` select.

- [ ] **Step 5: Update `app/server/api/receipts/pending.get.ts`**

Lines 42-45 — replace `institution: true, officeCategory: true` with `offices` include.

- [ ] **Step 6: Update `app/server/api/admin/declarations.get.ts`**

Lines 66-74 — replace `institution: true, officeCategory: true` with `offices` include. Keep the `user` select.

Update the response mapping (lines 110-123). Replace:

```typescript
        applicant: {
          fullName: d.applicant.fullName,
          ghanaCardNumber: d.applicant.ghanaCardNumber,
          designation: d.applicant.designation,
          institution: d.applicant.institution,
          officeCategory: d.applicant.officeCategory,
          user: d.applicant.user,
        },
```

With:

```typescript
        applicant: {
          fullName: d.applicant.fullName,
          ghanaCardNumber: d.applicant.ghanaCardNumber,
          offices: d.applicant.offices,
          user: d.applicant.user,
        },
```

- [ ] **Step 7: Update `app/server/api/admin/users/index.get.ts`**

Lines 71-79 — replace the `applicantProfile` select to include offices:

```typescript
        applicantProfile: {
          select: {
            fullName: true,
            ghanaCardNumber: true,
            offices: {
              include: {
                officeCategory: true,
                institution: true,
              },
              orderBy: { startDate: "desc" as const },
            },
          },
        },
```

Update the response mapping (lines 101-108). Replace:

```typescript
        profile: user.applicantProfile
          ? {
              fullName: user.applicantProfile.fullName,
              ghanaCardNumber: user.applicantProfile.ghanaCardNumber,
              designation: user.applicantProfile.designation,
              institution: user.applicantProfile.institution?.name || null,
            }
          : null,
```

With:

```typescript
        profile: user.applicantProfile
          ? {
              fullName: user.applicantProfile.fullName,
              ghanaCardNumber: user.applicantProfile.ghanaCardNumber,
              offices: user.applicantProfile.offices,
            }
          : null,
```

- [ ] **Step 8: Commit**

```bash
git add app/server/api/declarations/ app/server/api/admin/ app/server/api/verify/ app/server/api/submissions/ app/server/api/reviews/ app/server/api/receipts/
git commit -m "feat: update all query endpoints to include offices relation"
```

---

## Task 6: Update receipt PDF generation

**Files:**
- Modify: `app/server/services/pdf.service.ts:4-16, 120-129`
- Modify: `app/server/api/receipts/[declarationId].post.ts:98-109`

- [ ] **Step 1: Update `ReceiptData` interface to accept offices array**

In `app/server/services/pdf.service.ts`, replace the `ReceiptData` interface (lines 4-16) with:

```typescript
interface OfficeEntry {
  designation: string;
  institution: string;
  officeCategory: string;
}

interface ReceiptData {
  receiptNumber: string;
  declarationCode: string;
  applicantName: string;
  ghanaCardNumber: string;
  offices: OfficeEntry[];
  submissionDate: Date;
  approvalDate: Date;
  approvedBy: string;
  sealNumber?: string;
}
```

- [ ] **Step 2: Update PDF detail rendering for multiple offices**

Replace the `details` array and its rendering loop (lines 120-149) with:

```typescript
  const details = [
    { label: "Declaration Code:", value: data.declarationCode },
    { label: "Full Name:", value: data.applicantName },
    { label: "Ghana Card Number:", value: data.ghanaCardNumber },
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
```

- [ ] **Step 3: Update receipt generation endpoint to pass active offices**

In `app/server/api/receipts/[declarationId].post.ts`, replace the `generateReceiptPDF` call (lines 98-109) with:

```typescript
  const today = new Date();
  const activeOffices = declaration.applicant.offices
    .filter((o: { endDate: Date | null }) => !o.endDate || new Date(o.endDate) > today)
    .map((o: { designation: string; institution: { name: string } | null; officeCategory: { name: string } | null }) => ({
      designation: o.designation,
      institution: o.institution?.name || "N/A",
      officeCategory: o.officeCategory?.name || "N/A",
    }));

  const pdfUrl = await generateReceiptPDF({
    receiptNumber,
    declarationCode: declaration.uniqueCode,
    applicantName: declaration.applicant.fullName,
    ghanaCardNumber: declaration.applicant.ghanaCardNumber,
    offices: activeOffices,
    submissionDate: declaration.submittedAt || declaration.createdAt,
    approvalDate: review?.reviewDate || new Date(),
    approvedBy: reviewer?.email || "System",
    sealNumber: `SEAL-${Date.now()}`,
  });
```

Also update the Prisma include in the same file (lines 45-49) — replace `institution: true, officeCategory: true` with `offices` include:

```typescript
      applicant: {
        include: {
          user: true,
          offices: {
            include: {
              officeCategory: true,
              institution: true,
            },
          },
        },
      },
```

- [ ] **Step 4: Commit**

```bash
git add app/server/services/pdf.service.ts app/server/api/receipts/
git commit -m "feat: update receipt PDF to list multiple active offices"
```

---

## Task 7: Update profile setup page (Step 3)

**Files:**
- Modify: `app/pages/applicant/profile/setup.vue`

- [ ] **Step 1: Rework script section for multi-office Step 3**

Replace the form state and step 3 logic. The full `<script setup>` needs these changes:

Remove `designation`, `institutionId`, `officeCategoryId` from the `form` reactive object. Add:

```typescript
interface OfficeEntry {
  id?: string;
  designation: string;
  institutionId: string | null;
  officeCategoryId: number | null;
  startDate: string;
  endDate: string;
}

const officeForm = reactive<OfficeEntry>({
  designation: "",
  institutionId: null,
  officeCategoryId: null,
  startDate: new Date().toISOString().split("T")[0],
  endDate: "",
});

const offices = ref<(OfficeEntry & { id: string; categoryName?: string; institutionName?: string })[]>([]);
const addingOffice = ref(false);
```

Update `isStepValid` for step 3:

```typescript
    case 3:
      return offices.value.length > 0;
```

Update `validateStep` for step 3 — remove old office validation.

Replace `handleSubmit` — the profile is now created without office fields, then the user adds offices in step 3:

```typescript
const handleSubmit = async () => {
  if (offices.value.length === 0) {
    error.value = "Please add at least one office.";
    return;
  }

  await authStore.fetchUser();
  router.push("/applicant/dashboard");
};

const createProfile = async () => {
  error.value = "";
  isLoading.value = true;

  try {
    await authFetch("/api/profile", {
      method: "POST",
      body: {
        fullName: form.fullName,
        ghanaCardNumber: form.ghanaCardNumber,
        ghanaCardFrontUrl: form.ghanaCardFrontUrl,
        ghanaCardBackUrl: form.ghanaCardBackUrl || undefined,
      },
    });
  } catch (err: unknown) {
    error.value = handleServerError(err);
    isLoading.value = false;
    throw err;
  } finally {
    isLoading.value = false;
  }
};

const nextStep = async () => {
  if (!validateStep()) return;

  if (currentStep.value === 2) {
    try {
      await createProfile();
      currentStep.value = 3;
    } catch {
      // error already set
    }
    return;
  }

  if (currentStep.value < totalSteps) {
    currentStep.value++;
  }
};

const validateOfficeForm = (): boolean => {
  clearAll();
  if (!officeForm.designation || officeForm.designation.length < 2) {
    fieldErrors.designation = "Designation is required (at least 2 characters)";
  }
  if (!officeForm.officeCategoryId) {
    fieldErrors.officeCategoryId = "Please select a category";
  }
  if (!officeForm.startDate) {
    fieldErrors.startDate = "Start date is required";
  }
  if (officeForm.endDate && officeForm.startDate && officeForm.endDate <= officeForm.startDate) {
    fieldErrors.endDate = "End date must be after start date";
  }
  return Object.keys(fieldErrors).length === 0;
};

const addOffice = async () => {
  if (!validateOfficeForm()) return;

  addingOffice.value = true;
  error.value = "";

  try {
    const response = await authFetch<{ success: boolean; data: any }>("/api/profile/offices", {
      method: "POST",
      body: {
        designation: officeForm.designation,
        officeCategoryId: officeForm.officeCategoryId,
        institutionId: officeForm.institutionId || undefined,
        startDate: officeForm.startDate,
        endDate: officeForm.endDate || undefined,
      },
    });

    if (response.success) {
      offices.value.push({
        id: response.data.id,
        designation: response.data.designation,
        officeCategoryId: response.data.officeCategoryId,
        institutionId: response.data.institutionId,
        startDate: response.data.startDate,
        endDate: response.data.endDate || "",
        categoryName: response.data.officeCategory?.name,
        institutionName: response.data.institution?.name,
      });

      officeForm.designation = "";
      officeForm.institutionId = null;
      officeForm.officeCategoryId = null;
      officeForm.startDate = new Date().toISOString().split("T")[0];
      officeForm.endDate = "";
      clearAll();
    }
  } catch (err: unknown) {
    error.value = handleServerError(err);
  } finally {
    addingOffice.value = false;
  }
};

const removeOffice = async (officeId: string) => {
  try {
    await authFetch(`/api/profile/offices/${officeId}`, { method: "DELETE" });
    offices.value = offices.value.filter((o) => o.id !== officeId);
  } catch (err: unknown) {
    error.value = handleServerError(err);
  }
};
```

- [ ] **Step 2: Replace Step 3 template section**

Replace the `<!-- Step 3: Office Details -->` section (lines 402-471) with:

```html
          <!-- Step 3: Office Details -->
          <div v-show="currentStep === 3" class="space-y-6">
            <h3 class="text-lg font-semibold text-foreground">Office Details</h3>
            <p class="text-sm text-muted-foreground">Add at least one public office you currently hold or have held.</p>

            <!-- Added offices list -->
            <div v-if="offices.length > 0" class="space-y-3">
              <div
                v-for="office in offices"
                :key="office.id"
                class="flex items-start justify-between p-4 border rounded-lg bg-muted/30"
              >
                <div>
                  <p class="font-medium text-foreground">{{ office.designation }}</p>
                  <p class="text-sm text-muted-foreground">{{ office.categoryName }}</p>
                  <p v-if="office.institutionName" class="text-sm text-muted-foreground">{{ office.institutionName }}</p>
                  <p class="text-xs text-muted-foreground mt-1">
                    From {{ office.startDate }}
                    <span v-if="office.endDate"> to {{ office.endDate }}</span>
                    <span v-else class="text-primary font-medium"> — Current</span>
                  </p>
                </div>
                <Button
                  v-if="offices.length > 1"
                  type="button"
                  variant="ghost"
                  size="sm"
                  class="text-destructive"
                  @click="removeOffice(office.id)"
                >
                  Remove
                </Button>
              </div>
            </div>

            <!-- Add office form -->
            <div class="border rounded-lg p-4 space-y-4">
              <h4 class="text-sm font-medium text-foreground">Add Office</h4>

              <div class="space-y-2">
                <Label for="officeCategoryId">
                  Public Office Category <span class="text-destructive">*</span>
                </Label>
                <select
                  id="officeCategoryId"
                  v-model="officeForm.officeCategoryId"
                  class="w-full px-4 py-2 border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  :class="{ 'border-destructive': fieldErrors.officeCategoryId }"
                  @change="clearFieldError('officeCategoryId')"
                >
                  <option :value="null" disabled>Select category</option>
                  <option
                    v-for="cat in categories?.data || []"
                    :key="cat.id"
                    :value="cat.id"
                  >
                    {{ cat.name }}
                  </option>
                </select>
                <p v-if="fieldErrors.officeCategoryId" class="text-xs text-destructive">
                  {{ fieldErrors.officeCategoryId }}
                </p>
              </div>

              <div class="space-y-2">
                <Label for="institutionId">Institution</Label>
                <select
                  id="institutionId"
                  v-model="officeForm.institutionId"
                  class="w-full px-4 py-2 border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option :value="null">Select institution (optional)</option>
                  <option
                    v-for="inst in institutions?.data || []"
                    :key="inst.id"
                    :value="inst.id"
                  >
                    {{ inst.name }}
                  </option>
                </select>
              </div>

              <div class="space-y-2">
                <Label for="designation">
                  Designation / Position <span class="text-destructive">*</span>
                </Label>
                <Input
                  id="designation"
                  v-model="officeForm.designation"
                  type="text"
                  placeholder="e.g., Deputy Minister, Director, etc."
                  :class="{ 'border-destructive': fieldErrors.designation }"
                  @input="clearFieldError('designation')"
                />
                <p v-if="fieldErrors.designation" class="text-xs text-destructive">
                  {{ fieldErrors.designation }}
                </p>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2">
                  <Label for="startDate">
                    Start Date <span class="text-destructive">*</span>
                  </Label>
                  <Input
                    id="startDate"
                    v-model="officeForm.startDate"
                    type="date"
                    :class="{ 'border-destructive': fieldErrors.startDate }"
                    @input="clearFieldError('startDate')"
                  />
                  <p v-if="fieldErrors.startDate" class="text-xs text-destructive">
                    {{ fieldErrors.startDate }}
                  </p>
                </div>
                <div class="space-y-2">
                  <Label for="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    v-model="officeForm.endDate"
                    type="date"
                  />
                  <p v-if="fieldErrors.endDate" class="text-xs text-destructive">
                    {{ fieldErrors.endDate }}
                  </p>
                  <p v-else class="text-xs text-muted-foreground">Leave blank if current</p>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                :disabled="addingOffice"
                @click="addOffice"
              >
                {{ addingOffice ? "Adding..." : "Add Office" }}
              </Button>
            </div>
          </div>
```

- [ ] **Step 3: Update the submit button logic**

In the navigation buttons section (lines 474-494), update the form's `@submit.prevent` handler. The form tag (line 243) should become:

```html
        <form novalidate @submit.prevent="currentStep === totalSteps ? handleSubmit() : nextStep()">
```

This stays the same. But update the submit button text — when on step 3, label it "Complete Setup" and it should only be enabled when `offices.length > 0`:

```html
            <Button
              v-if="currentStep === totalSteps"
              type="submit"
              :disabled="isLoading || offices.length === 0"
            >
              <span v-if="isLoading">Completing...</span>
              <span v-else>Complete Setup</span>
            </Button>
            <Button
              v-else
              type="submit"
              :disabled="isLoading"
            >
              <span v-if="isLoading">Loading...</span>
              <span v-else>Continue</span>
            </Button>
```

- [ ] **Step 4: Commit**

```bash
git add app/pages/applicant/profile/setup.vue
git commit -m "feat: rework profile setup step 3 for multiple offices"
```

---

## Task 8: Update profile edit page

**Files:**
- Modify: `app/pages/applicant/profile/edit.vue`

- [ ] **Step 1: Rework script section for office list management**

Replace the entire `<script setup>` with:

```typescript
<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";

definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const authStore = useAuthStore();

interface Office {
  id: string;
  designation: string;
  officeCategoryId: number;
  institutionId: string | null;
  startDate: string;
  endDate: string | null;
  officeCategory: { id: number; name: string } | null;
  institution: { id: string; name: string } | null;
}

const readOnly = reactive({
  fullName: "",
  ghanaCardNumber: "",
});

const isLoading = ref(true);
const error = ref("");
const success = ref("");
const { fieldErrors, clearFieldError, clearAll, handleServerError } = useFieldErrors();

const offices = ref<Office[]>([]);
const editingOfficeId = ref<string | null>(null);
const showAddForm = ref(false);

const officeForm = reactive({
  designation: "",
  institutionId: null as string | null,
  officeCategoryId: null as number | null,
  startDate: new Date().toISOString().split("T")[0],
  endDate: "" as string,
});
const savingOffice = ref(false);

const [profileRes, institutionsRes, categoriesRes] = await Promise.all([
  authFetch("/api/profile"),
  $fetch("/api/institutions"),
  $fetch("/api/categories"),
]);

const profile = (profileRes as any).data;
const institutions = (institutionsRes as any).data || [];
const categories = (categoriesRes as any).data || [];

readOnly.fullName = profile.fullName ?? "";
readOnly.ghanaCardNumber = profile.ghanaCardNumber ?? "";
offices.value = (profile.offices || []).map((o: any) => ({
  ...o,
  startDate: o.startDate ? o.startDate.split("T")[0] : "",
  endDate: o.endDate ? o.endDate.split("T")[0] : null,
}));

isLoading.value = false;

function resetOfficeForm() {
  officeForm.designation = "";
  officeForm.institutionId = null;
  officeForm.officeCategoryId = null;
  officeForm.startDate = new Date().toISOString().split("T")[0];
  officeForm.endDate = "";
  editingOfficeId.value = null;
  showAddForm.value = false;
  clearAll();
}

function startEdit(office: Office) {
  editingOfficeId.value = office.id;
  officeForm.designation = office.designation;
  officeForm.officeCategoryId = office.officeCategoryId;
  officeForm.institutionId = office.institutionId;
  officeForm.startDate = office.startDate;
  officeForm.endDate = office.endDate || "";
  showAddForm.value = true;
  clearAll();
}

function startAdd() {
  resetOfficeForm();
  showAddForm.value = true;
}

function validateOfficeForm(): boolean {
  clearAll();
  if (!officeForm.designation || officeForm.designation.length < 2) {
    fieldErrors.designation = "Designation is required (at least 2 characters)";
  }
  if (!officeForm.officeCategoryId) {
    fieldErrors.officeCategoryId = "Please select a category";
  }
  if (!officeForm.startDate) {
    fieldErrors.startDate = "Start date is required";
  }
  if (officeForm.endDate && officeForm.startDate && officeForm.endDate <= officeForm.startDate) {
    fieldErrors.endDate = "End date must be after start date";
  }
  return Object.keys(fieldErrors).length === 0;
}

async function saveOffice() {
  if (!validateOfficeForm()) return;

  savingOffice.value = true;
  error.value = "";
  success.value = "";

  const body = {
    designation: officeForm.designation,
    officeCategoryId: officeForm.officeCategoryId,
    institutionId: officeForm.institutionId || undefined,
    startDate: officeForm.startDate,
    endDate: officeForm.endDate || undefined,
  };

  try {
    if (editingOfficeId.value) {
      const response = await authFetch<{ success: boolean; data: any }>(`/api/profile/offices/${editingOfficeId.value}`, {
        method: "PUT",
        body,
      });

      if (response.success) {
        const idx = offices.value.findIndex((o) => o.id === editingOfficeId.value);
        if (idx !== -1) {
          offices.value[idx] = {
            ...response.data,
            startDate: response.data.startDate.split("T")[0],
            endDate: response.data.endDate ? response.data.endDate.split("T")[0] : null,
          };
        }
        success.value = "Office updated successfully.";
      }
    } else {
      const response = await authFetch<{ success: boolean; data: any }>("/api/profile/offices", {
        method: "POST",
        body,
      });

      if (response.success) {
        offices.value.push({
          ...response.data,
          startDate: response.data.startDate.split("T")[0],
          endDate: response.data.endDate ? response.data.endDate.split("T")[0] : null,
        });
        success.value = "Office added successfully.";
      }
    }

    resetOfficeForm();
  } catch (err: unknown) {
    error.value = handleServerError(err);
  } finally {
    savingOffice.value = false;
  }
}

async function removeOffice(officeId: string) {
  error.value = "";
  success.value = "";

  try {
    await authFetch(`/api/profile/offices/${officeId}`, { method: "DELETE" });
    offices.value = offices.value.filter((o) => o.id !== officeId);
    success.value = "Office removed successfully.";
    if (editingOfficeId.value === officeId) {
      resetOfficeForm();
    }
  } catch (err: unknown) {
    error.value = handleServerError(err);
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Current";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
</script>
```

- [ ] **Step 2: Replace template section**

Replace the entire `<template>` with:

```html
<template>
  <div class="max-w-2xl">
    <AppPageHeader
      title="Edit Profile"
      description="Update your office details and information"
    />

    <Card class="mb-6">
      <CardHeader>
        <CardTitle>Personal Details</CardTitle>
        <CardDescription>
          Legal identity fields are read-only. Contact an administrator to change them.
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="space-y-2">
          <Label>Full Name</Label>
          <input
            type="text"
            :value="readOnly.fullName"
            disabled
            class="w-full px-4 py-2 border rounded-md bg-muted text-muted-foreground cursor-not-allowed"
          />
        </div>
        <div class="space-y-2">
          <Label>Ghana Card Number</Label>
          <input
            type="text"
            :value="readOnly.ghanaCardNumber"
            disabled
            class="w-full px-4 py-2 border rounded-md bg-muted text-muted-foreground cursor-not-allowed uppercase"
          />
        </div>
      </CardContent>
    </Card>

    <!-- Success / Error alerts -->
    <Alert v-if="success" class="mb-6 border-green-200 bg-green-50 text-green-800">
      <AlertDescription>{{ success }}</AlertDescription>
    </Alert>
    <Alert v-if="error" variant="destructive" class="mb-6">
      <AlertDescription>{{ error }}</AlertDescription>
    </Alert>

    <Card>
      <CardHeader>
        <div class="flex items-center justify-between">
          <div>
            <CardTitle>Office Details</CardTitle>
            <CardDescription>Manage your public offices</CardDescription>
          </div>
          <Button v-if="!showAddForm" type="button" size="sm" @click="startAdd">
            Add Office
          </Button>
        </div>
      </CardHeader>
      <CardContent class="space-y-4">
        <!-- Existing offices -->
        <div
          v-for="office in offices"
          :key="office.id"
          class="flex items-start justify-between p-4 border rounded-lg"
          :class="office.endDate ? 'bg-muted/30' : ''"
        >
          <div>
            <p class="font-medium text-foreground">{{ office.designation }}</p>
            <p class="text-sm text-muted-foreground">{{ office.officeCategory?.name }}</p>
            <p v-if="office.institution" class="text-sm text-muted-foreground">{{ office.institution.name }}</p>
            <p class="text-xs text-muted-foreground mt-1">
              {{ formatDate(office.startDate) }} —
              <span v-if="office.endDate">{{ formatDate(office.endDate) }}</span>
              <span v-else class="text-primary font-medium">Current</span>
            </p>
          </div>
          <div class="flex gap-2">
            <Button type="button" variant="ghost" size="sm" @click="startEdit(office)">
              Edit
            </Button>
            <Button
              v-if="offices.length > 1"
              type="button"
              variant="ghost"
              size="sm"
              class="text-destructive"
              @click="removeOffice(office.id)"
            >
              Remove
            </Button>
          </div>
        </div>

        <p v-if="offices.length === 0" class="text-center text-muted-foreground py-4">
          No offices added yet.
        </p>

        <!-- Add / Edit office form -->
        <div v-if="showAddForm" class="border rounded-lg p-4 space-y-4 mt-4">
          <h4 class="text-sm font-medium text-foreground">
            {{ editingOfficeId ? "Edit Office" : "Add Office" }}
          </h4>

          <div class="space-y-2">
            <Label for="edit-officeCategoryId">
              Public Office Category <span class="text-destructive">*</span>
            </Label>
            <Select v-model="officeForm.officeCategoryId" @update:model-value="clearFieldError('officeCategoryId')">
              <SelectTrigger
                id="edit-officeCategoryId"
                class="w-full"
                :class="{ 'border-destructive': fieldErrors.officeCategoryId }"
              >
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="cat in categories"
                  :key="cat.id"
                  :value="cat.id"
                >
                  {{ cat.name }}
                </SelectItem>
              </SelectContent>
            </Select>
            <p v-if="fieldErrors.officeCategoryId" class="text-xs text-destructive">
              {{ fieldErrors.officeCategoryId }}
            </p>
          </div>

          <div class="space-y-2">
            <Label for="edit-institutionId">Institution</Label>
            <Select v-model="officeForm.institutionId">
              <SelectTrigger id="edit-institutionId" class="w-full">
                <SelectValue placeholder="Select institution (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="null">None</SelectItem>
                <SelectItem
                  v-for="inst in institutions"
                  :key="inst.id"
                  :value="inst.id"
                >
                  {{ inst.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2">
            <Label for="edit-designation">
              Designation / Position <span class="text-destructive">*</span>
            </Label>
            <Input
              id="edit-designation"
              v-model="officeForm.designation"
              type="text"
              placeholder="e.g., Deputy Minister, Director, etc."
              :class="{ 'border-destructive': fieldErrors.designation }"
              @input="clearFieldError('designation')"
            />
            <p v-if="fieldErrors.designation" class="text-xs text-destructive">
              {{ fieldErrors.designation }}
            </p>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label for="edit-startDate">Start Date <span class="text-destructive">*</span></Label>
              <Input
                id="edit-startDate"
                v-model="officeForm.startDate"
                type="date"
                :class="{ 'border-destructive': fieldErrors.startDate }"
                @input="clearFieldError('startDate')"
              />
              <p v-if="fieldErrors.startDate" class="text-xs text-destructive">
                {{ fieldErrors.startDate }}
              </p>
            </div>
            <div class="space-y-2">
              <Label for="edit-endDate">End Date</Label>
              <Input
                id="edit-endDate"
                v-model="officeForm.endDate"
                type="date"
              />
              <p v-if="fieldErrors.endDate" class="text-xs text-destructive">
                {{ fieldErrors.endDate }}
              </p>
              <p v-else class="text-xs text-muted-foreground">Leave blank if current</p>
            </div>
          </div>

          <div class="flex gap-2">
            <Button type="button" :disabled="savingOffice" @click="saveOffice">
              {{ savingOffice ? "Saving..." : (editingOfficeId ? "Update Office" : "Add Office") }}
            </Button>
            <Button type="button" variant="outline" @click="resetOfficeForm">Cancel</Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <div class="mt-6">
      <NuxtLink to="/applicant/dashboard">
        <Button type="button" variant="outline">Back to Dashboard</Button>
      </NuxtLink>
    </div>
  </div>
</template>
```

- [ ] **Step 3: Commit**

```bash
git add app/pages/applicant/profile/edit.vue
git commit -m "feat: rework profile edit page for multiple offices"
```

---

## Task 9: Update declaration new page and remaining frontend pages

**Files:**
- Modify: `app/pages/applicant/declaration/new.vue:164-188`
- Modify: `app/pages/officer/submissions.vue` (type + display)
- Modify: `app/pages/officer/reviews.vue` (type + display)
- Modify: `app/pages/officer/receipts.vue` (type + display)
- Modify: `app/pages/legal/verify.vue` (type + display)
- Modify: `app/pages/admin/users.vue` (type)
- Modify: `app/pages/admin/declarations.vue` (type + display)

- [ ] **Step 1: Update declaration new page — profile summary**

In `app/pages/applicant/declaration/new.vue`, replace the profile summary `<dl>` (lines 166-188) with:

```html
          <dl class="space-y-3">
            <div class="flex justify-between">
              <dt class="text-muted-foreground">Full Name</dt>
              <dd class="font-medium text-foreground">{{ profile?.fullName }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-muted-foreground">Ghana Card</dt>
              <dd class="font-medium text-foreground">{{ profile?.ghanaCardNumber }}</dd>
            </div>
          </dl>
          <div v-if="profile?.offices?.length" class="mt-4">
            <p class="text-sm text-muted-foreground mb-2">Office(s) Held:</p>
            <div
              v-for="office in profile.offices"
              :key="office.id"
              class="text-sm border-l-2 border-primary/30 pl-3 mb-2"
            >
              <p class="font-medium text-foreground">{{ office.designation }}</p>
              <p class="text-muted-foreground">{{ office.officeCategory?.name }}</p>
              <p v-if="office.institution" class="text-muted-foreground">{{ office.institution.name }}</p>
            </div>
          </div>
```

- [ ] **Step 2: Update officer pages — types and display**

In each of `app/pages/officer/submissions.vue`, `app/pages/officer/reviews.vue`, and `app/pages/officer/receipts.vue`:

Replace the type's `designation: string;` and `officeCategory: { name: string } | null;` fields with:

```typescript
    offices: Array<{
      id: string;
      designation: string;
      startDate: string;
      endDate: string | null;
      officeCategory: { name: string } | null;
      institution: { name: string } | null;
    }>;
```

In the templates, replace any `{{ declaration.applicant.designation }}` with:

```html
{{ declaration.applicant.offices?.[0]?.designation || 'N/A' }}
```

And replace `{{ declaration.applicant.officeCategory?.name || 'N/A' }}` with:

```html
{{ declaration.applicant.offices?.[0]?.officeCategory?.name || 'N/A' }}
```

- [ ] **Step 3: Update legal verify page — type and display**

In `app/pages/legal/verify.vue`, replace the applicant type (lines 17-21) to use `offices` array (same shape as step 2). Update the template references on lines 215, 223, 225, 227 to use `offices[0]` or iterate.

- [ ] **Step 4: Update admin pages — types**

In `app/pages/admin/users.vue`, replace the `profile` type (lines 16-21):

```typescript
  profile: {
    fullName: string;
    ghanaCardNumber: string;
    offices: Array<{
      designation: string;
      officeCategory: { name: string } | null;
      institution: { name: string } | null;
    }>;
  } | null;
```

In `app/pages/admin/declarations.vue`, update any references from `d.applicant.designation` / `d.applicant.officeCategory` to use `d.applicant.offices`.

- [ ] **Step 5: Commit**

```bash
git add app/pages/
git commit -m "feat: update all frontend pages for multiple offices display"
```

---

## Task 10: Verify and test

- [ ] **Step 1: Run Prisma generate to ensure schema is valid**

```bash
cd app && npm run db:generate
```

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Fix any lint errors that arise.

- [ ] **Step 3: Run type check**

```bash
npx nuxi typecheck
```

Fix any type errors.

- [ ] **Step 4: Start dev server and test manually**

```bash
npm run dev
```

Test the following:
1. Profile setup flow — create profile (steps 1-2), then add offices in step 3
2. Profile edit — view offices list, add a new office, edit an existing one, remove one (but not the last)
3. Declaration creation — verify offices show in profile summary
4. Verify office date validation (end date after start date)

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address lint and type errors from multiple offices feature"
```
