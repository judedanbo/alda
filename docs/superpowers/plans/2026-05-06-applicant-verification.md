# Applicant Verification Stage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a verification gate between profile completion and declaration creation, where legal officers review and approve applicant registrations before they can create declarations.

**Architecture:** New `VerificationStatus` enum and `ApplicantVerificationReview` history model in Prisma. A `verificationStatus` field on `ApplicantProfile` is the single source of truth for gating. Legal officers get a queue page and detail page. Existing endpoints and UI are modified to enforce the gate. All transitions are audited and trigger notifications.

**Tech Stack:** Nuxt 4, Prisma (Postgres), shadcn-vue, Tailwind v4, Zod validation, Pinia stores, nodemailer

---

## File Map

**Create:**
- `app/server/api/legal/verifications/index.get.ts` — list verification requests
- `app/server/api/legal/verifications/stats.get.ts` — status counts
- `app/server/api/legal/verifications/[id].get.ts` — single verification detail
- `app/server/api/legal/verifications/[id]/review.post.ts` — submit review decision
- `app/server/api/applicant/verification/index.get.ts` — own verification status
- `app/server/api/applicant/verification/resubmit.post.ts` — resubmit after rejection
- `app/pages/legal/verifications/index.vue` — verification queue page
- `app/pages/legal/verifications/[id].vue` — verification detail page

**Modify:**
- `app/prisma/schema.prisma` — add enum, model, fields, relations
- `app/server/utils/audit.ts` — add verification audit actions
- `app/server/utils/validators.ts` — add verification review schema
- `app/server/services/notification.service.ts` — add verification notification helpers
- `app/server/services/email.service.ts` — add verification email templates
- `app/server/api/profile/index.post.ts` — add verification-requested audit log
- `app/server/api/declarations/index.post.ts` — add verification status gate
- `app/server/api/auth/me.get.ts` — include verificationStatus in response
- `app/stores/auth.ts` — add verificationStatus and isVerified computed
- `app/composables/useAuth.ts` — expose isVerified
- `app/layouts/dashboard.vue` — add legal nav item, disable applicant nav when unverified
- `app/pages/applicant/dashboard.vue` — add verification banner, disable actions
- `app/pages/applicant/declarations.vue` — disable "New Declaration" when unverified
- `app/pages/legal/dashboard.vue` — add verification summary cards

---

## Task 1: Prisma Schema — Enum, Model, and Field

**Files:**
- Modify: `app/prisma/schema.prisma`

- [ ] **Step 1: Add VerificationStatus enum after the DeclarationStatus enum (line ~177)**

Add this after the closing `}` of `DeclarationStatus`:

```prisma
enum VerificationStatus {
  PENDING_VERIFICATION
  VERIFIED
  ON_HOLD
  MORE_INFO_REQUIRED
  REJECTED

  @@map("verification_status")
}
```

- [ ] **Step 2: Add verificationStatus field and relation to ApplicantProfile**

In the `ApplicantProfile` model, add after the `updatedAt` field (before the `// Relations` comment):

```prisma
  verificationStatus VerificationStatus @default(PENDING_VERIFICATION) @map("verification_status")
```

Add to the relations section (after `declarations   Declaration[]`):

```prisma
  verificationReviews ApplicantVerificationReview[]
```

Add an index inside the model (before `@@map`):

```prisma
  @@index([verificationStatus])
```

- [ ] **Step 3: Add ApplicantVerificationReview model**

Add this new model after `ApplicantProfile` (before the `// Reference Data` section):

```prisma
model ApplicantVerificationReview {
  id                 String             @id @default(uuid()) @db.Uuid
  applicantId        String             @map("applicant_id") @db.Uuid
  reviewerId         String             @map("reviewer_id") @db.Uuid
  status             VerificationStatus
  reason             String             @db.Text
  messageToApplicant String?            @map("message_to_applicant") @db.Text
  createdAt          DateTime           @default(now()) @map("created_at")

  // Relations
  applicant ApplicantProfile @relation(fields: [applicantId], references: [id], onDelete: Cascade)
  reviewer  User             @relation("VerificationReviewedBy", fields: [reviewerId], references: [id])

  @@index([applicantId])
  @@index([createdAt])
  @@map("applicant_verification_reviews")
}
```

- [ ] **Step 4: Add relation on User model**

In the `User` model, add after `declarationStatusChanges`:

```prisma
  verificationReviews          ApplicantVerificationReview[] @relation("VerificationReviewedBy")
```

- [ ] **Step 5: Add new NotificationType enum values**

In the `NotificationType` enum, add after `EMAIL_VERIFICATION`:

```prisma
  VERIFICATION_SUBMITTED
  VERIFICATION_APPROVED
  VERIFICATION_REJECTED
  VERIFICATION_ON_HOLD
  VERIFICATION_MORE_INFO_REQUIRED
```

- [ ] **Step 6: Run migration**

```bash
cd app && npm run db:migrate -- --name add_applicant_verification
```

Expected: Migration creates `verification_status` enum, `applicant_verification_reviews` table, adds `verification_status` column to `applicant_profiles` with default `PENDING_VERIFICATION`.

- [ ] **Step 7: Regenerate Prisma client**

```bash
cd app && npm run db:generate
```

- [ ] **Step 8: Commit**

```bash
git add app/prisma/
git commit -m "feat: add VerificationStatus enum and ApplicantVerificationReview model"
```

---

## Task 2: Audit Actions and Validation Schema

**Files:**
- Modify: `app/server/utils/audit.ts`
- Modify: `app/server/utils/validators.ts`

- [ ] **Step 1: Add verification audit actions**

In `app/server/utils/audit.ts`, add a new section after the `// Categories` block in the `AuditActions` object (before the closing `} as const`):

```typescript
  // Applicant Verification
  APPLICANT_VERIFICATION_REQUESTED: "applicant_verification_requested",
  APPLICANT_VERIFICATION_REVIEWED: "applicant_verification_reviewed",
  APPLICANT_VERIFICATION_VERIFIED: "applicant_verification_verified",
  APPLICANT_VERIFICATION_ON_HOLD: "applicant_verification_on_hold",
  APPLICANT_VERIFICATION_MORE_INFO: "applicant_verification_more_info",
  APPLICANT_VERIFICATION_REJECTED: "applicant_verification_rejected",
  APPLICANT_VERIFICATION_RESUBMITTED: "applicant_verification_resubmitted",
```

- [ ] **Step 2: Add verification review validation schema**

In `app/server/utils/validators.ts`, add after the `reviewSchema`:

```typescript
/**
 * Verification review schema (legal officer decision)
 */
export const verificationReviewSchema = z.object({
  status: z.enum(["VERIFIED", "ON_HOLD", "MORE_INFO_REQUIRED", "REJECTED"]),
  reason: z.string().min(1, "Reason is required"),
  messageToApplicant: z.string().optional(),
}).refine(
  (data) => data.status !== "MORE_INFO_REQUIRED" || (data.messageToApplicant && data.messageToApplicant.length > 0),
  {
    message: "A message to the applicant is required when requesting more information",
    path: ["messageToApplicant"],
  }
);
```

- [ ] **Step 3: Commit**

```bash
git add app/server/utils/audit.ts app/server/utils/validators.ts
git commit -m "feat: add verification audit actions and review validation schema"
```

---

## Task 3: Notification Service — Verification Helpers

**Files:**
- Modify: `app/server/services/email.service.ts`
- Modify: `app/server/services/notification.service.ts`

- [ ] **Step 1: Add verification email templates**

In `app/server/services/email.service.ts`, add to the `EmailTemplate` type:

```typescript
  | "verification-submitted"
  | "verification-approved"
  | "verification-rejected"
  | "verification-on-hold"
  | "verification-more-info";
```

Then add these templates to the `templates` object inside `generateEmailHtml`:

```typescript
    "verification-submitted": `
      ${baseStyle}
      <div class="container">
        <div class="header">
          <h1>Registration Under Review</h1>
        </div>
        <div class="content">
          <p>Dear ${data.name || "User"},</p>
          <p>Your registration is now being reviewed by our legal office. This process typically takes 1-3 business days.</p>
          <p>You will be notified once a decision has been made. You can check your verification status at any time by logging into your account.</p>
        </div>
        <div class="footer">
          <p>Republic of Ghana - Asset Declaration System</p>
        </div>
      </div>
    `,

    "verification-approved": `
      ${baseStyle}
      <div class="container">
        <div class="header" style="background-color: #16A34A;">
          <h1>Registration Verified</h1>
        </div>
        <div class="content">
          <p>Dear ${data.name || "User"},</p>
          <p>Congratulations! Your registration has been <strong>verified</strong> by the legal office.</p>
          <p>You can now create and submit asset declarations through your dashboard.</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${data.dashboardUrl}" class="button">Go to Dashboard</a>
          </p>
        </div>
        <div class="footer">
          <p>Republic of Ghana - Asset Declaration System</p>
        </div>
      </div>
    `,

    "verification-rejected": `
      ${baseStyle}
      <div class="container">
        <div class="header" style="background-color: #DC2626;">
          <h1>Registration Not Approved</h1>
        </div>
        <div class="content">
          <p>Dear ${data.name || "User"},</p>
          <p>Your registration could not be approved at this time.</p>
          <p><strong>Reason:</strong></p>
          <p style="padding: 15px; background: #fef2f2; border-left: 4px solid #DC2626;">${data.reason}</p>
          ${data.messageToApplicant ? `<p><strong>Message from reviewer:</strong></p><p style="padding: 15px; background: #f0f9ff; border-left: 4px solid #3B82F6;">${data.messageToApplicant}</p>` : ""}
          <p>You can update your profile and resubmit for verification through your dashboard.</p>
        </div>
        <div class="footer">
          <p>Republic of Ghana - Asset Declaration System</p>
        </div>
      </div>
    `,

    "verification-on-hold": `
      ${baseStyle}
      <div class="container">
        <div class="header" style="background-color: #EA580C;">
          <h1>Registration Under Investigation</h1>
        </div>
        <div class="content">
          <p>Dear ${data.name || "User"},</p>
          <p>Your registration has been placed on hold for further review.</p>
          <p><strong>Reason:</strong></p>
          <p style="padding: 15px; background: #fff7ed; border-left: 4px solid #EA580C;">${data.reason}</p>
          <p>Please wait for further updates. You will be notified once a final decision is made.</p>
        </div>
        <div class="footer">
          <p>Republic of Ghana - Asset Declaration System</p>
        </div>
      </div>
    `,

    "verification-more-info": `
      ${baseStyle}
      <div class="container">
        <div class="header" style="background-color: #2563EB;">
          <h1>Additional Information Required</h1>
        </div>
        <div class="content">
          <p>Dear ${data.name || "User"},</p>
          <p>The legal office requires additional information to complete your registration verification.</p>
          <p><strong>Request:</strong></p>
          <p style="padding: 15px; background: #f0f9ff; border-left: 4px solid #2563EB;">${data.messageToApplicant}</p>
          <p>Please update your profile with the requested information and resubmit for verification.</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${data.dashboardUrl}" class="button">Update Profile</a>
          </p>
        </div>
        <div class="footer">
          <p>Republic of Ghana - Asset Declaration System</p>
        </div>
      </div>
    `,
```

- [ ] **Step 2: Update the email template mapping in notification.service.ts**

In `app/server/services/notification.service.ts`, update the `mapNotificationTypeToEmailTemplate` function. Add these entries to the `mapping` object:

```typescript
    VERIFICATION_SUBMITTED: "verification-submitted",
    VERIFICATION_APPROVED: "verification-approved",
    VERIFICATION_REJECTED: "verification-rejected",
    VERIFICATION_ON_HOLD: "verification-on-hold",
    VERIFICATION_MORE_INFO_REQUIRED: "verification-more-info",
```

- [ ] **Step 3: Add verification notification helper**

In `app/server/services/notification.service.ts`, add after the `notifyPickupReady` function:

```typescript
/**
 * Send verification status change notification
 */
export async function notifyVerificationStatusChanged(
  userId: string,
  status: "VERIFIED" | "ON_HOLD" | "MORE_INFO_REQUIRED" | "REJECTED",
  name: string,
  reason: string,
  messageToApplicant?: string,
): Promise<void> {
  const config = useRuntimeConfig();
  const dashboardUrl = `${config.public.appUrl}/applicant/dashboard`;

  const typeMap: Record<string, NotificationType> = {
    VERIFIED: "VERIFICATION_APPROVED",
    ON_HOLD: "VERIFICATION_ON_HOLD",
    MORE_INFO_REQUIRED: "VERIFICATION_MORE_INFO_REQUIRED",
    REJECTED: "VERIFICATION_REJECTED",
  };

  const titleMap: Record<string, string> = {
    VERIFIED: "Registration Verified",
    ON_HOLD: "Registration Under Investigation",
    MORE_INFO_REQUIRED: "Additional Information Required",
    REJECTED: "Registration Not Approved",
  };

  const messageMap: Record<string, string> = {
    VERIFIED: "Your registration has been verified. You can now create asset declarations.",
    ON_HOLD: `Your registration is under investigation. Reason: ${reason}`,
    MORE_INFO_REQUIRED: `Additional information required: ${messageToApplicant || reason}`,
    REJECTED: `Your registration was not approved. Reason: ${reason}`,
  };

  const channelMap: Record<string, NotificationChannel[]> = {
    VERIFIED: ["EMAIL", "SMS", "IN_APP"],
    ON_HOLD: ["EMAIL", "IN_APP"],
    MORE_INFO_REQUIRED: ["EMAIL", "SMS", "IN_APP"],
    REJECTED: ["EMAIL", "IN_APP"],
  };

  await sendNotification({
    userId,
    type: typeMap[status]!,
    title: titleMap[status]!,
    message: messageMap[status]!,
    metadata: { name, reason, messageToApplicant, dashboardUrl },
    channels: channelMap[status],
  });
}

/**
 * Send notification that verification was submitted
 */
export async function notifyVerificationSubmitted(
  userId: string,
  name: string,
): Promise<void> {
  await sendNotification({
    userId,
    type: "VERIFICATION_SUBMITTED",
    title: "Registration Under Review",
    message: "Your registration is now being reviewed by the legal office.",
    metadata: { name },
    channels: ["EMAIL", "IN_APP"],
  });
}
```

Add this import at the top of `notification.service.ts` (it's already there for `NotificationChannel`, just ensure `NotificationType` is also imported — it should already be):

```typescript
import type { NotificationType, NotificationChannel } from "@prisma/client";
```

- [ ] **Step 4: Commit**

```bash
git add app/server/services/email.service.ts app/server/services/notification.service.ts
git commit -m "feat: add verification email templates and notification helpers"
```

---

## Task 4: Modify Existing Endpoints — Gate and Expose Status

**Files:**
- Modify: `app/server/api/declarations/index.post.ts`
- Modify: `app/server/api/profile/index.post.ts`
- Modify: `app/server/api/auth/me.get.ts`

- [ ] **Step 1: Add verification gate to declaration creation**

In `app/server/api/declarations/index.post.ts`, add this check after the `emailVerified` check (after line 38) and before the existing pending declaration check:

```typescript
  // Check verification status
  if (profile.verificationStatus !== "VERIFIED") {
    throw createError({
      statusCode: 403,
      statusMessage: "Forbidden",
      message: "Your registration must be verified before creating declarations",
    });
  }
```

Note: The existing `findUnique` on line 17 already fetches the profile, and since `verificationStatus` is now a field on `ApplicantProfile`, it will be included automatically. No query changes needed.

- [ ] **Step 2: Add verification audit log to profile creation**

In `app/server/api/profile/index.post.ts`, add after the existing `createAuditLog` call (after line 101), and import `notifyVerificationSubmitted`:

Add to imports at top:

```typescript
import { notifyVerificationSubmitted } from "~/server/services/notification.service";
```

Add after the existing audit log call:

```typescript
  // Log verification request
  await createAuditLog(event, {
    userId: auth.userId,
    action: AuditActions.APPLICANT_VERIFICATION_REQUESTED,
    entityType: "applicant_profile",
    entityId: profile.id,
    newValues: {
      verificationStatus: "PENDING_VERIFICATION",
    },
  });

  // Notify applicant that verification is in progress
  await notifyVerificationSubmitted(auth.userId, data.fullName);
```

- [ ] **Step 3: Include verificationStatus in /api/auth/me response**

In `app/server/api/auth/me.get.ts`, update the profile section of the response (around line 49-57). Change the profile object to include `verificationStatus`:

```typescript
      profile: user.applicantProfile
        ? {
            id: user.applicantProfile.id,
            fullName: user.applicantProfile.fullName,
            ghanaCardNumber: user.applicantProfile.ghanaCardNumber,
            designation: user.applicantProfile.designation,
            institution: user.applicantProfile.institution,
            officeCategory: user.applicantProfile.officeCategory,
            verificationStatus: user.applicantProfile.verificationStatus,
          }
        : null,
```

- [ ] **Step 4: Commit**

```bash
git add app/server/api/declarations/index.post.ts app/server/api/profile/index.post.ts app/server/api/auth/me.get.ts
git commit -m "feat: add verification gate to declarations and expose status in /me"
```

---

## Task 5: Legal Officer API — List and Stats

**Files:**
- Create: `app/server/api/legal/verifications/index.get.ts`
- Create: `app/server/api/legal/verifications/stats.get.ts`

- [ ] **Step 1: Create the verifications list endpoint**

Create `app/server/api/legal/verifications/index.get.ts`:

```typescript
import prisma from "~/server/utils/prisma";
import type { VerificationStatus } from "@prisma/client";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const query = getQuery(event);
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
  const skip = (page - 1) * limit;
  const status = query.status as VerificationStatus | undefined;
  const search = (query.search as string)?.trim();

  const where: Record<string, unknown> = {};

  if (status) {
    where.verificationStatus = status;
  }

  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: "insensitive" } },
      { ghanaCardNumber: { contains: search, mode: "insensitive" } },
      { user: { email: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [profiles, total] = await Promise.all([
    prisma.applicantProfile.findMany({
      where,
      include: {
        user: { select: { email: true, phone: true, createdAt: true } },
        institution: { select: { name: true } },
        officeCategory: { select: { name: true, articleReference: true } },
        verificationReviews: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            reviewer: { select: { email: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.applicantProfile.count({ where }),
  ]);

  return {
    success: true,
    data: {
      profiles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  };
});
```

- [ ] **Step 2: Create the stats endpoint**

Create `app/server/api/legal/verifications/stats.get.ts`:

```typescript
import prisma from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const [pending, verified, onHold, moreInfo, rejected] = await Promise.all([
    prisma.applicantProfile.count({ where: { verificationStatus: "PENDING_VERIFICATION" } }),
    prisma.applicantProfile.count({ where: { verificationStatus: "VERIFIED" } }),
    prisma.applicantProfile.count({ where: { verificationStatus: "ON_HOLD" } }),
    prisma.applicantProfile.count({ where: { verificationStatus: "MORE_INFO_REQUIRED" } }),
    prisma.applicantProfile.count({ where: { verificationStatus: "REJECTED" } }),
  ]);

  return {
    success: true,
    data: {
      PENDING_VERIFICATION: pending,
      VERIFIED: verified,
      ON_HOLD: onHold,
      MORE_INFO_REQUIRED: moreInfo,
      REJECTED: rejected,
      total: pending + verified + onHold + moreInfo + rejected,
    },
  };
});
```

- [ ] **Step 3: Commit**

```bash
git add app/server/api/legal/verifications/
git commit -m "feat: add GET /api/legal/verifications list and stats endpoints"
```

---

## Task 6: Legal Officer API — Detail and Review

**Files:**
- Create: `app/server/api/legal/verifications/[id].get.ts`
- Create: `app/server/api/legal/verifications/[id]/review.post.ts`

- [ ] **Step 1: Create the verification detail endpoint**

Create `app/server/api/legal/verifications/[id].get.ts`:

```typescript
import prisma from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const id = getRouterParam(event, "id");

  const profile = await prisma.applicantProfile.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          phone: true,
          emailVerified: true,
          createdAt: true,
        },
      },
      institution: true,
      officeCategory: true,
      verificationReviews: {
        orderBy: { createdAt: "desc" },
        include: {
          reviewer: { select: { email: true } },
        },
      },
    },
  });

  if (!profile) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Applicant profile not found",
    });
  }

  return {
    success: true,
    data: profile,
  };
});
```

- [ ] **Step 2: Create the review action endpoint**

Create `app/server/api/legal/verifications/[id]/review.post.ts`:

```typescript
import prisma from "~/server/utils/prisma";
import { validateBody, verificationReviewSchema } from "~/server/utils/validators";
import { createAuditLog, AuditActions } from "~/server/utils/audit";
import { notifyVerificationStatusChanged } from "~/server/services/notification.service";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const id = getRouterParam(event, "id");
  const body = await validateBody(event, verificationReviewSchema);

  const profile = await prisma.applicantProfile.findUnique({
    where: { id },
    include: { user: { select: { id: true } } },
  });

  if (!profile) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Applicant profile not found",
    });
  }

  const oldStatus = profile.verificationStatus;

  const [updatedProfile, review] = await prisma.$transaction([
    prisma.applicantProfile.update({
      where: { id },
      data: { verificationStatus: body.status },
    }),
    prisma.applicantVerificationReview.create({
      data: {
        applicantId: id!,
        reviewerId: auth.userId,
        status: body.status,
        reason: body.reason,
        messageToApplicant: body.messageToApplicant,
      },
    }),
  ]);

  const statusAuditMap: Record<string, string> = {
    VERIFIED: AuditActions.APPLICANT_VERIFICATION_VERIFIED,
    ON_HOLD: AuditActions.APPLICANT_VERIFICATION_ON_HOLD,
    MORE_INFO_REQUIRED: AuditActions.APPLICANT_VERIFICATION_MORE_INFO,
    REJECTED: AuditActions.APPLICANT_VERIFICATION_REJECTED,
  };

  await createAuditLog(event, {
    userId: auth.userId,
    action: statusAuditMap[body.status]!,
    entityType: "applicant_profile",
    entityId: id,
    oldValues: { verificationStatus: oldStatus },
    newValues: {
      verificationStatus: body.status,
      reason: body.reason,
      messageToApplicant: body.messageToApplicant,
      reviewerId: auth.userId,
    },
  });

  await notifyVerificationStatusChanged(
    profile.user.id,
    body.status,
    profile.fullName,
    body.reason,
    body.messageToApplicant,
  );

  return {
    success: true,
    message: `Applicant verification status updated to ${body.status}`,
    data: { profile: updatedProfile, review },
  };
});
```

- [ ] **Step 3: Commit**

```bash
git add app/server/api/legal/verifications/
git commit -m "feat: add GET /api/legal/verifications/[id] and POST review endpoint"
```

---

## Task 7: Applicant API — Own Status and Resubmit

**Files:**
- Create: `app/server/api/applicant/verification/index.get.ts`
- Create: `app/server/api/applicant/verification/resubmit.post.ts`

- [ ] **Step 1: Create the applicant verification status endpoint**

Create `app/server/api/applicant/verification/index.get.ts`:

```typescript
import prisma from "~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const profile = await prisma.applicantProfile.findUnique({
    where: { userId: auth.userId },
    select: {
      id: true,
      verificationStatus: true,
      verificationReviews: {
        orderBy: { createdAt: "desc" },
        include: {
          reviewer: { select: { email: true } },
        },
      },
    },
  });

  if (!profile) {
    throw createError({
      statusCode: 404,
      statusMessage: "Not Found",
      message: "Profile not found. Please complete your profile first.",
    });
  }

  const latestReview = profile.verificationReviews[0] || null;

  return {
    success: true,
    data: {
      verificationStatus: profile.verificationStatus,
      latestReview: latestReview
        ? {
            status: latestReview.status,
            reason: latestReview.reason,
            messageToApplicant: latestReview.messageToApplicant,
            createdAt: latestReview.createdAt,
          }
        : null,
      reviewHistory: profile.verificationReviews,
    },
  };
});
```

- [ ] **Step 2: Create the resubmit endpoint**

Create `app/server/api/applicant/verification/resubmit.post.ts`:

```typescript
import prisma from "~/server/utils/prisma";
import { createAuditLog, AuditActions } from "~/server/utils/audit";
import { notifyVerificationSubmitted } from "~/server/services/notification.service";

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
      statusMessage: "Not Found",
      message: "Profile not found",
    });
  }

  if (profile.verificationStatus !== "REJECTED" && profile.verificationStatus !== "MORE_INFO_REQUIRED") {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Resubmission is only allowed when status is REJECTED or MORE_INFO_REQUIRED",
    });
  }

  const oldStatus = profile.verificationStatus;

  const updatedProfile = await prisma.applicantProfile.update({
    where: { id: profile.id },
    data: { verificationStatus: "PENDING_VERIFICATION" },
  });

  await createAuditLog(event, {
    userId: auth.userId,
    action: AuditActions.APPLICANT_VERIFICATION_RESUBMITTED,
    entityType: "applicant_profile",
    entityId: profile.id,
    oldValues: { verificationStatus: oldStatus },
    newValues: { verificationStatus: "PENDING_VERIFICATION" },
  });

  await notifyVerificationSubmitted(auth.userId, profile.fullName);

  return {
    success: true,
    message: "Verification resubmitted successfully",
    data: { verificationStatus: updatedProfile.verificationStatus },
  };
});
```

- [ ] **Step 3: Commit**

```bash
git add app/server/api/applicant/verification/
git commit -m "feat: add applicant verification status and resubmit endpoints"
```

---

## Task 8: Auth Store and Composable — Add Verification State

**Files:**
- Modify: `app/stores/auth.ts`
- Modify: `app/composables/useAuth.ts`

- [ ] **Step 1: Add verificationStatus to User interface and store**

In `app/stores/auth.ts`, update the `User` interface (line 4-11) to add the field:

```typescript
export interface User {
  id: string;
  email: string;
  phone: string | null;
  emailVerified: boolean;
  roles: string[];
  hasProfile?: boolean;
  verificationStatus?: string;
}
```

- [ ] **Step 2: Add isVerified computed**

In `app/stores/auth.ts`, add after the `isEmailVerified` computed (line 31):

```typescript
  const isVerified = computed(() => user.value?.verificationStatus === "VERIFIED");
```

- [ ] **Step 3: Update fetchUser to include verificationStatus**

In `app/stores/auth.ts`, update the `fetchUser` function. In the `user.value = { ... }` assignment (around line 156-163), add `verificationStatus`:

```typescript
        user.value = {
          id: response.data.id,
          email: response.data.email,
          phone: response.data.phone,
          emailVerified: response.data.emailVerified,
          roles: response.data.roles,
          hasProfile: !!response.data.profile,
          verificationStatus: response.data.profile?.verificationStatus,
        };
```

- [ ] **Step 4: Export isVerified from store**

In `app/stores/auth.ts`, add `isVerified` to the return object (around line 220-245):

```typescript
  return {
    // State
    user,
    tokens,
    loading,
    initialized,
    // Getters
    isAuthenticated,
    isApplicant,
    isOfficer,
    isLegalUnit,
    isAdmin,
    isEmailVerified,
    isVerified,
    // Actions
    ...
  };
```

- [ ] **Step 5: Expose isVerified from useAuth composable**

In `app/composables/useAuth.ts`, add the computed and export:

```typescript
export function useAuth() {
  const store = useAuthStore();

  const user = computed(() => store.user);
  const isAuthenticated = computed(() => store.isAuthenticated);
  const isEmailVerified = computed(() => store.user?.emailVerified ?? false);
  const isVerified = computed(() => store.isVerified);
  const isApplicant = computed(() => store.isApplicant);
  const isOfficer = computed(() => store.isOfficer);
  const isLegalUnit = computed(() => store.isLegalUnit);
  const isAdmin = computed(() => store.isAdmin);

  return {
    user,
    isAuthenticated,
    isEmailVerified,
    isVerified,
    isApplicant,
    isOfficer,
    isLegalUnit,
    isAdmin,
    login: store.login,
    logout: store.logout,
    register: store.register,
  };
}
```

- [ ] **Step 6: Commit**

```bash
git add app/stores/auth.ts app/composables/useAuth.ts
git commit -m "feat: add verificationStatus and isVerified to auth store"
```

---

## Task 9: Dashboard Layout Nav — Verification Items and Gating

**Files:**
- Modify: `app/layouts/dashboard.vue`

- [ ] **Step 1: Add verifications nav item for legal and disable New Declaration for unverified applicants**

In `app/layouts/dashboard.vue`, update the `navigation` computed. The legal unit section (line 38-42) becomes:

```typescript
  if (authStore.isLegalUnit) {
    return [
      { name: "Dashboard", href: "/legal/dashboard", icon: "home" },
      { name: "Applicant Verifications", href: "/legal/verifications", icon: "user-check" },
      { name: "Verify Code", href: "/legal/verify", icon: "search" },
    ];
  }
```

For the applicant section (line 20-25), add a `disabled` flag to the New Declaration item:

```typescript
  if (authStore.isApplicant) {
    return [
      ...baseNav,
      { name: "My Declarations", href: "/applicant/declarations", icon: "file-text" },
      { name: "New Declaration", href: "/applicant/declaration/new", icon: "plus-circle", disabled: !authStore.isVerified },
    ];
  }
```

- [ ] **Step 2: Update the navigation item type and template to support disabled**

Update the `NuxtLink` rendering in the template (both desktop and mobile nav). For the desktop nav (around line 83-97), replace the existing `NuxtLink` with:

```vue
            <component
              :is="item.disabled ? 'span' : NuxtLink"
              v-for="item in navigation"
              :key="item.name"
              v-bind="item.disabled ? {} : { to: item.href }"
              class="px-3 py-2 text-sm font-medium rounded-md transition-colors"
              :class="[
                item.disabled
                  ? 'text-muted-foreground/50 cursor-not-allowed'
                  : route.path === item.href || route.path.startsWith(item.href + '/')
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              ]"
              :title="item.disabled ? 'Registration verification required' : undefined"
            >
              {{ item.name }}
            </component>
```

Apply the same pattern to the mobile nav (around line 140-154):

```vue
          <component
            :is="item.disabled ? 'span' : NuxtLink"
            v-for="item in navigation"
            :key="item.name"
            v-bind="item.disabled ? {} : { to: item.href }"
            class="px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap transition-colors"
            :class="[
              item.disabled
                ? 'text-muted-foreground/50 cursor-not-allowed'
                : route.path === item.href || route.path.startsWith(item.href + '/')
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            ]"
            :title="item.disabled ? 'Registration verification required' : undefined"
          >
            {{ item.name }}
          </component>
```

- [ ] **Step 3: Commit**

```bash
git add app/layouts/dashboard.vue
git commit -m "feat: add legal verifications nav item and disable New Declaration when unverified"
```

---

## Task 10: Applicant Dashboard — Verification Banner

**Files:**
- Modify: `app/pages/applicant/dashboard.vue`

- [ ] **Step 1: Add verification status banner and update gating logic**

In `app/pages/applicant/dashboard.vue`, update the script to include `isVerified`:

```typescript
const { user, isEmailVerified, isVerified } = useAuth();
```

Add a ref for the verification info (for displaying latest review reason/message):

```typescript
const verificationInfo = ref<{ reason?: string; messageToApplicant?: string } | null>(null);

async function fetchVerificationInfo() {
  if (user.value?.hasProfile && !isVerified.value) {
    try {
      const response = await authFetch<{ data: { latestReview: any } }>("/api/applicant/verification");
      verificationInfo.value = response.data.latestReview;
    } catch {
      // Ignore — banner will show without details
    }
  }
}

onMounted(fetchVerificationInfo);
```

- [ ] **Step 2: Add the verification status banner in the template**

In the template, add this after the "Profile Setup Alert" block (after the closing `</Alert>` on line 107) and before the Stats Grid:

```vue
    <!-- Verification Status Banner -->
    <Alert
      v-if="user?.hasProfile && user?.verificationStatus && user.verificationStatus !== 'VERIFIED'"
      :class="{
        'border-amber-200 bg-amber-50': user.verificationStatus === 'PENDING_VERIFICATION',
        'border-orange-200 bg-orange-50': user.verificationStatus === 'ON_HOLD',
        'border-blue-200 bg-blue-50': user.verificationStatus === 'MORE_INFO_REQUIRED',
        'border-red-200 bg-red-50': user.verificationStatus === 'REJECTED',
      }"
    >
      <svg
        class="w-5 h-5"
        :class="{
          'text-amber-600': user.verificationStatus === 'PENDING_VERIFICATION',
          'text-orange-600': user.verificationStatus === 'ON_HOLD',
          'text-blue-600': user.verificationStatus === 'MORE_INFO_REQUIRED',
          'text-red-600': user.verificationStatus === 'REJECTED',
        }"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <AlertTitle>
        <span v-if="user.verificationStatus === 'PENDING_VERIFICATION'">Registration Under Review</span>
        <span v-else-if="user.verificationStatus === 'ON_HOLD'">Registration Under Investigation</span>
        <span v-else-if="user.verificationStatus === 'MORE_INFO_REQUIRED'">Action Required</span>
        <span v-else-if="user.verificationStatus === 'REJECTED'">Registration Not Approved</span>
      </AlertTitle>
      <AlertDescription>
        <p v-if="user.verificationStatus === 'PENDING_VERIFICATION'">
          Your registration is being reviewed by the legal office. You will be notified once a decision is made.
        </p>
        <p v-else-if="user.verificationStatus === 'ON_HOLD'">
          Your registration is under review. Please wait for further updates.
        </p>
        <div v-else-if="user.verificationStatus === 'MORE_INFO_REQUIRED'">
          <p>The legal office has requested additional information.</p>
          <p v-if="verificationInfo?.messageToApplicant" class="mt-2 p-3 bg-blue-100 rounded text-sm">
            {{ verificationInfo.messageToApplicant }}
          </p>
          <div class="flex gap-2 mt-3">
            <Button as-child size="sm">
              <NuxtLink to="/applicant/profile/edit">Edit Profile</NuxtLink>
            </Button>
          </div>
        </div>
        <div v-else-if="user.verificationStatus === 'REJECTED'">
          <p>Your registration was not approved.</p>
          <p v-if="verificationInfo?.reason" class="mt-2 p-3 bg-red-100 rounded text-sm">
            {{ verificationInfo.reason }}
          </p>
          <div class="flex gap-2 mt-3">
            <Button as-child size="sm">
              <NuxtLink to="/applicant/profile/edit">Edit Profile & Resubmit</NuxtLink>
            </Button>
          </div>
        </div>
      </AlertDescription>
    </Alert>
```

- [ ] **Step 3: Update the "New Declaration" quick action gating**

Change the existing `:class` on the "New Declaration" `NuxtLink` (line 132-133) from:

```vue
:class="{ 'opacity-50 pointer-events-none': !user?.hasProfile }"
```

to:

```vue
:class="{ 'opacity-50 pointer-events-none': !user?.hasProfile || !isVerified }"
```

- [ ] **Step 4: Commit**

```bash
git add app/pages/applicant/dashboard.vue
git commit -m "feat: add verification status banner and gate New Declaration on dashboard"
```

---

## Task 11: Applicant Declarations Page — Gate Create Button

**Files:**
- Modify: `app/pages/applicant/declarations.vue`

- [ ] **Step 1: Add verification gating to the declarations page**

In `app/pages/applicant/declarations.vue`, add `isVerified` to the script:

```typescript
const { isVerified } = useAuth();
```

- [ ] **Step 2: Disable the header "New Declaration" button**

Update the `<template #actions>` block (lines 38-47). Wrap the button so it's disabled when unverified:

```vue
      <template #actions>
        <Button
          as-child
          :disabled="!isVerified"
          :class="{ 'opacity-50 pointer-events-none': !isVerified }"
        >
          <NuxtLink
            :to="isVerified ? '/applicant/declaration/new' : undefined"
            class="flex items-center gap-2"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            New Declaration
          </NuxtLink>
        </Button>
      </template>
```

- [ ] **Step 3: Also gate the empty-state "Create Declaration" button**

Update the empty-state button (line 111-113):

```vue
        <Button v-if="statusFilter === 'ALL' && isVerified" as-child>
          <NuxtLink to="/applicant/declaration/new">Create Declaration</NuxtLink>
        </Button>
```

- [ ] **Step 4: Commit**

```bash
git add app/pages/applicant/declarations.vue
git commit -m "feat: gate declaration creation buttons on verification status"
```

---

## Task 12: Legal Dashboard — Verification Summary Cards

**Files:**
- Modify: `app/pages/legal/dashboard.vue`

- [ ] **Step 1: Add verification stats fetching to the script**

Replace the script section in `app/pages/legal/dashboard.vue`:

```typescript
<script setup lang="ts">
definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const { data: statsData } = await useAsyncData(
  "verification-stats",
  () => authFetch<{ data: Record<string, number> }>("/api/legal/verifications/stats"),
);

const verificationStats = computed(() => statsData.value?.data || {
  PENDING_VERIFICATION: 0,
  ON_HOLD: 0,
  MORE_INFO_REQUIRED: 0,
  VERIFIED: 0,
  REJECTED: 0,
  total: 0,
});
</script>
```

- [ ] **Step 2: Add verification summary cards to the template**

Add this block at the top of the template (after the `PageHeader`, before the Quick Verify Card):

```vue
    <!-- Verification Summary -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <NuxtLink to="/legal/verifications?status=PENDING_VERIFICATION">
        <Card class="hover:border-primary/50 transition-colors">
          <CardContent class="p-6">
            <p class="text-sm text-muted-foreground">Pending Review</p>
            <p class="text-3xl font-bold text-amber-600 mt-2">
              {{ verificationStats.PENDING_VERIFICATION }}
            </p>
          </CardContent>
        </Card>
      </NuxtLink>
      <NuxtLink to="/legal/verifications?status=ON_HOLD">
        <Card class="hover:border-primary/50 transition-colors">
          <CardContent class="p-6">
            <p class="text-sm text-muted-foreground">On Hold</p>
            <p class="text-3xl font-bold text-orange-600 mt-2">
              {{ verificationStats.ON_HOLD }}
            </p>
          </CardContent>
        </Card>
      </NuxtLink>
      <NuxtLink to="/legal/verifications?status=MORE_INFO_REQUIRED">
        <Card class="hover:border-primary/50 transition-colors">
          <CardContent class="p-6">
            <p class="text-sm text-muted-foreground">More Info Required</p>
            <p class="text-3xl font-bold text-blue-600 mt-2">
              {{ verificationStats.MORE_INFO_REQUIRED }}
            </p>
          </CardContent>
        </Card>
      </NuxtLink>
      <NuxtLink to="/legal/verifications?status=VERIFIED">
        <Card class="hover:border-primary/50 transition-colors">
          <CardContent class="p-6">
            <p class="text-sm text-muted-foreground">Verified</p>
            <p class="text-3xl font-bold text-green-600 mt-2">
              {{ verificationStats.VERIFIED }}
            </p>
          </CardContent>
        </Card>
      </NuxtLink>
    </div>
```

- [ ] **Step 3: Commit**

```bash
git add app/pages/legal/dashboard.vue
git commit -m "feat: add verification summary cards to legal dashboard"
```

---

## Task 13: Legal Verifications Queue Page

**Files:**
- Create: `app/pages/legal/verifications/index.vue`

- [ ] **Step 1: Create the verifications queue page**

Create `app/pages/legal/verifications/index.vue`:

```vue
<script setup lang="ts">
definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const route = useRoute();
const page = ref(1);
const statusFilter = ref((route.query.status as string) || "ALL");
const search = ref("");

const statusQuery = computed(() => statusFilter.value === "ALL" ? undefined : statusFilter.value);

const { data, pending, error, refresh } = await useAsyncData(
  "legal-verifications",
  () => authFetch<{ data: { profiles: any[]; pagination: any } }>("/api/legal/verifications", {
    query: {
      page: page.value,
      limit: 20,
      status: statusQuery.value,
      search: search.value || undefined,
    },
  }),
  { watch: [page, statusQuery, search] },
);

const profiles = computed(() => data.value?.data?.profiles || []);
const pagination = computed(() => data.value?.data?.pagination);

const statusColors: Record<string, string> = {
  PENDING_VERIFICATION: "bg-amber-100 text-amber-800",
  VERIFIED: "bg-green-100 text-green-800",
  ON_HOLD: "bg-orange-100 text-orange-800",
  MORE_INFO_REQUIRED: "bg-blue-100 text-blue-800",
  REJECTED: "bg-red-100 text-red-800",
};

const statusLabels: Record<string, string> = {
  PENDING_VERIFICATION: "Pending",
  VERIFIED: "Verified",
  ON_HOLD: "On Hold",
  MORE_INFO_REQUIRED: "More Info",
  REJECTED: "Rejected",
};

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="Applicant Verifications" description="Review and verify applicant registrations" />

    <!-- Filters -->
    <div class="flex flex-col sm:flex-row gap-4">
      <div class="flex-1">
        <input
          v-model="search"
          type="text"
          placeholder="Search by name, Ghana Card, or email..."
          class="w-full px-4 py-2 border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      <Select v-model="statusFilter">
        <SelectTrigger class="w-[220px]">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All Statuses</SelectItem>
          <SelectItem value="PENDING_VERIFICATION">Pending Review</SelectItem>
          <SelectItem value="ON_HOLD">On Hold</SelectItem>
          <SelectItem value="MORE_INFO_REQUIRED">More Info Required</SelectItem>
          <SelectItem value="VERIFIED">Verified</SelectItem>
          <SelectItem value="REJECTED">Rejected</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <!-- Loading -->
    <div v-if="pending" class="space-y-4">
      <Card v-for="n in 3" :key="n">
        <CardContent class="p-6">
          <div class="flex items-center gap-4">
            <Skeleton class="h-12 w-12 rounded-full" />
            <div class="flex-1 space-y-2">
              <Skeleton class="h-5 w-48" />
              <Skeleton class="h-4 w-32" />
            </div>
            <Skeleton class="h-6 w-20 rounded-full" />
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="text-center py-12">
      <p class="text-destructive">Failed to load verifications</p>
      <Button variant="link" class="mt-4" @click="refresh()">Try again</Button>
    </div>

    <!-- Empty -->
    <Card v-else-if="profiles.length === 0" class="text-center py-12">
      <CardContent>
        <p class="text-muted-foreground">No verification requests found</p>
      </CardContent>
    </Card>

    <!-- List -->
    <div v-else class="space-y-3">
      <NuxtLink
        v-for="profile in profiles"
        :key="profile.id"
        :to="`/legal/verifications/${profile.id}`"
        class="block"
      >
        <Card class="hover:border-primary/50 transition-colors">
          <CardContent class="p-6">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  {{ profile.fullName?.charAt(0).toUpperCase() }}
                </div>
                <div>
                  <p class="font-medium text-foreground">{{ profile.fullName }}</p>
                  <p class="text-sm text-muted-foreground">
                    {{ profile.ghanaCardNumber }} &bull; {{ profile.user?.email }}
                  </p>
                  <p class="text-xs text-muted-foreground mt-1">
                    {{ profile.officeCategory?.name }}
                    <span v-if="profile.institution"> &bull; {{ profile.institution.name }}</span>
                    &bull; Registered {{ formatDate(profile.createdAt) }}
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <span
                  class="px-3 py-1 rounded-full text-xs font-medium"
                  :class="statusColors[profile.verificationStatus] || 'bg-muted text-muted-foreground'"
                >
                  {{ statusLabels[profile.verificationStatus] || profile.verificationStatus }}
                </span>
                <svg class="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>
      </NuxtLink>
    </div>

    <!-- Pagination -->
    <div
      v-if="pagination && pagination.totalPages > 1"
      class="flex items-center justify-center gap-2 mt-8"
    >
      <Button variant="outline" size="sm" :disabled="page <= 1" @click="page--">Previous</Button>
      <span class="text-sm text-muted-foreground">
        Page {{ pagination.page }} of {{ pagination.totalPages }}
      </span>
      <Button variant="outline" size="sm" :disabled="page >= pagination.totalPages" @click="page++">Next</Button>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add app/pages/legal/verifications/index.vue
git commit -m "feat: add legal verifications queue page"
```

---

## Task 14: Legal Verification Detail Page

**Files:**
- Create: `app/pages/legal/verifications/[id].vue`

- [ ] **Step 1: Create the verification detail page**

Create `app/pages/legal/verifications/[id].vue`:

```vue
<script setup lang="ts">
definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const route = useRoute();
const id = route.params.id as string;

const { data, pending, error, refresh } = await useAsyncData(
  `verification-${id}`,
  () => authFetch<{ data: any }>(`/api/legal/verifications/${id}`),
);

const profile = computed(() => data.value?.data);

const reviewForm = ref({
  status: "" as string,
  reason: "",
  messageToApplicant: "",
});

const submitting = ref(false);
const submitError = ref("");

async function submitReview() {
  if (!reviewForm.value.status || !reviewForm.value.reason) return;

  submitting.value = true;
  submitError.value = "";

  try {
    await authFetch(`/api/legal/verifications/${id}/review`, {
      method: "POST",
      body: {
        status: reviewForm.value.status,
        reason: reviewForm.value.reason,
        messageToApplicant: reviewForm.value.messageToApplicant || undefined,
      },
    });

    reviewForm.value = { status: "", reason: "", messageToApplicant: "" };
    await refresh();
  } catch (e: any) {
    submitError.value = e.data?.message || "Failed to submit review";
  } finally {
    submitting.value = false;
  }
}

const statusColors: Record<string, string> = {
  PENDING_VERIFICATION: "bg-amber-100 text-amber-800",
  VERIFIED: "bg-green-100 text-green-800",
  ON_HOLD: "bg-orange-100 text-orange-800",
  MORE_INFO_REQUIRED: "bg-blue-100 text-blue-800",
  REJECTED: "bg-red-100 text-red-800",
};

const statusLabels: Record<string, string> = {
  PENDING_VERIFICATION: "Pending Verification",
  VERIFIED: "Verified",
  ON_HOLD: "On Hold",
  MORE_INFO_REQUIRED: "More Info Required",
  REJECTED: "Rejected",
};

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
</script>

<template>
  <div class="space-y-6">
    <!-- Back link -->
    <NuxtLink to="/legal/verifications" class="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
      Back to Verifications
    </NuxtLink>

    <!-- Loading -->
    <div v-if="pending" class="space-y-4">
      <Skeleton class="h-8 w-64" />
      <Card><CardContent class="p-6"><Skeleton class="h-40 w-full" /></CardContent></Card>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="text-center py-12">
      <p class="text-destructive">Failed to load applicant details</p>
      <Button variant="link" class="mt-4" @click="refresh()">Try again</Button>
    </div>

    <template v-else-if="profile">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-foreground">{{ profile.fullName }}</h1>
          <p class="text-muted-foreground">{{ profile.user?.email }}</p>
        </div>
        <span
          class="px-4 py-2 rounded-full text-sm font-medium"
          :class="statusColors[profile.verificationStatus] || 'bg-muted'"
        >
          {{ statusLabels[profile.verificationStatus] || profile.verificationStatus }}
        </span>
      </div>

      <div class="grid lg:grid-cols-3 gap-6">
        <!-- Left column: Applicant info -->
        <div class="lg:col-span-2 space-y-6">
          <!-- Personal Info -->
          <Card>
            <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
            <CardContent>
              <dl class="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt class="text-muted-foreground">Full Name</dt>
                  <dd class="font-medium">{{ profile.fullName }}</dd>
                </div>
                <div>
                  <dt class="text-muted-foreground">Ghana Card Number</dt>
                  <dd class="font-mono font-medium">{{ profile.ghanaCardNumber }}</dd>
                </div>
                <div>
                  <dt class="text-muted-foreground">Email</dt>
                  <dd class="font-medium">
                    {{ profile.user?.email }}
                    <span v-if="profile.user?.emailVerified" class="ml-2 text-xs text-green-600">(Verified)</span>
                    <span v-else class="ml-2 text-xs text-amber-600">(Not Verified)</span>
                  </dd>
                </div>
                <div>
                  <dt class="text-muted-foreground">Phone</dt>
                  <dd class="font-medium">{{ profile.user?.phone || "Not provided" }}</dd>
                </div>
                <div>
                  <dt class="text-muted-foreground">Registered</dt>
                  <dd class="font-medium">{{ formatDate(profile.user?.createdAt) }}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <!-- Ghana Card Images -->
          <Card>
            <CardHeader><CardTitle>Ghana Card Images</CardTitle></CardHeader>
            <CardContent>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p class="text-sm text-muted-foreground mb-2">Front</p>
                  <a :href="profile.ghanaCardFrontUrl" target="_blank" class="block">
                    <img
                      :src="profile.ghanaCardFrontUrl"
                      alt="Ghana Card Front"
                      class="w-full rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
                    />
                  </a>
                </div>
                <div v-if="profile.ghanaCardBackUrl">
                  <p class="text-sm text-muted-foreground mb-2">Back</p>
                  <a :href="profile.ghanaCardBackUrl" target="_blank" class="block">
                    <img
                      :src="profile.ghanaCardBackUrl"
                      alt="Ghana Card Back"
                      class="w-full rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
                    />
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- Office Details -->
          <Card>
            <CardHeader><CardTitle>Office Details</CardTitle></CardHeader>
            <CardContent>
              <dl class="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt class="text-muted-foreground">Designation</dt>
                  <dd class="font-medium">{{ profile.designation }}</dd>
                </div>
                <div>
                  <dt class="text-muted-foreground">Office Category</dt>
                  <dd class="font-medium">
                    {{ profile.officeCategory?.name }}
                    <span v-if="profile.officeCategory?.articleReference" class="text-xs text-muted-foreground ml-1">
                      ({{ profile.officeCategory.articleReference }})
                    </span>
                  </dd>
                </div>
                <div v-if="profile.institution">
                  <dt class="text-muted-foreground">Institution</dt>
                  <dd class="font-medium">{{ profile.institution.name }}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>

        <!-- Right column: Review panel + history -->
        <div class="space-y-6">
          <!-- Review Action Panel -->
          <Card>
            <CardHeader><CardTitle>Review Decision</CardTitle></CardHeader>
            <CardContent>
              <div class="space-y-4">
                <div>
                  <label class="text-sm font-medium mb-2 block">Decision</label>
                  <Select v-model="reviewForm.status">
                    <SelectTrigger>
                      <SelectValue placeholder="Select decision..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VERIFIED">Verify (Approve)</SelectItem>
                      <SelectItem value="ON_HOLD">Put On Hold</SelectItem>
                      <SelectItem value="MORE_INFO_REQUIRED">Request More Info</SelectItem>
                      <SelectItem value="REJECTED">Reject</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label class="text-sm font-medium mb-2 block">
                    Reason <span class="text-destructive">*</span>
                  </label>
                  <textarea
                    v-model="reviewForm.reason"
                    rows="3"
                    class="w-full px-3 py-2 border rounded-md bg-background text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Explain the reason for this decision..."
                  />
                </div>

                <div v-if="reviewForm.status === 'MORE_INFO_REQUIRED' || reviewForm.status === 'REJECTED'">
                  <label class="text-sm font-medium mb-2 block">
                    Message to Applicant
                    <span v-if="reviewForm.status === 'MORE_INFO_REQUIRED'" class="text-destructive">*</span>
                    <span v-else class="text-muted-foreground">(optional)</span>
                  </label>
                  <textarea
                    v-model="reviewForm.messageToApplicant"
                    rows="3"
                    class="w-full px-3 py-2 border rounded-md bg-background text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Specific message to the applicant..."
                  />
                </div>

                <div v-if="submitError" class="text-sm text-destructive">{{ submitError }}</div>

                <Button
                  class="w-full"
                  :disabled="!reviewForm.status || !reviewForm.reason || submitting"
                  @click="submitReview"
                >
                  {{ submitting ? "Submitting..." : "Submit Decision" }}
                </Button>
              </div>
            </CardContent>
          </Card>

          <!-- Review History -->
          <Card>
            <CardHeader><CardTitle>Review History</CardTitle></CardHeader>
            <CardContent>
              <div v-if="!profile.verificationReviews?.length" class="text-sm text-muted-foreground text-center py-4">
                No reviews yet
              </div>
              <div v-else class="space-y-4">
                <div
                  v-for="review in profile.verificationReviews"
                  :key="review.id"
                  class="border-l-2 pl-4 pb-4"
                  :class="{
                    'border-green-500': review.status === 'VERIFIED',
                    'border-orange-500': review.status === 'ON_HOLD',
                    'border-blue-500': review.status === 'MORE_INFO_REQUIRED',
                    'border-red-500': review.status === 'REJECTED',
                    'border-amber-500': review.status === 'PENDING_VERIFICATION',
                  }"
                >
                  <div class="flex items-center gap-2 mb-1">
                    <span
                      class="px-2 py-0.5 rounded text-xs font-medium"
                      :class="statusColors[review.status] || 'bg-muted'"
                    >
                      {{ statusLabels[review.status] || review.status }}
                    </span>
                    <span class="text-xs text-muted-foreground">
                      {{ formatDate(review.createdAt) }}
                    </span>
                  </div>
                  <p class="text-sm mt-1">{{ review.reason }}</p>
                  <p v-if="review.messageToApplicant" class="text-sm text-muted-foreground mt-1 italic">
                    To applicant: {{ review.messageToApplicant }}
                  </p>
                  <p class="text-xs text-muted-foreground mt-1">
                    by {{ review.reviewer?.email }}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </template>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add app/pages/legal/verifications/
git commit -m "feat: add legal verification detail page with review panel"
```

---

## Task 15: Seed Data Update

**Files:**
- Modify: `app/prisma/seed.ts`

- [ ] **Step 1: Update the applicant seed user to have PENDING_VERIFICATION status**

The seed file creates applicant profiles. Since `verificationStatus` defaults to `PENDING_VERIFICATION`, existing seed data will get the correct default. If there is a seed applicant profile that should be `VERIFIED` for testing, update that specific profile creation in the seed to include:

```typescript
verificationStatus: "VERIFIED",
```

Check the seed file for existing applicant profile creations and update them as needed. For any test user that should be able to create declarations, set `verificationStatus: "VERIFIED"`.

- [ ] **Step 2: Run the seed**

```bash
cd app && npm run db:seed
```

- [ ] **Step 3: Commit**

```bash
git add app/prisma/seed.ts
git commit -m "feat: update seed data with verification status for test users"
```

---

## Task 16: Manual Testing and Verification

- [ ] **Step 1: Start the dev server**

```bash
cd app && npm run dev
```

- [ ] **Step 2: Test the applicant flow**

1. Register a new applicant user
2. Complete the profile setup
3. Verify that the dashboard shows the "Registration Under Review" banner
4. Verify that the "New Declaration" button is disabled (dashboard, nav, declarations page)
5. Verify that `POST /api/declarations` returns 403

- [ ] **Step 3: Test the legal officer flow**

1. Log in as a legal officer
2. Verify the dashboard shows verification summary cards with counts
3. Navigate to "Applicant Verifications" in the nav
4. Verify the queue shows the pending applicant
5. Click into the detail page
6. Verify all applicant details display correctly (personal info, Ghana Card images, office details)
7. Submit a "More Info Required" decision with a message
8. Verify the applicant sees the request on their dashboard

- [ ] **Step 4: Test the resubmit flow**

1. As the applicant, edit profile with updated info
2. Verify the "Resubmit" flow works (status goes back to PENDING_VERIFICATION)
3. As legal officer, verify the updated profile appears in the queue
4. Approve the applicant
5. Verify the applicant can now create declarations

- [ ] **Step 5: Verify audit logs**

1. As admin, check the audit logs page
2. Verify all verification actions are recorded with old/new values

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found during manual testing"
```
