# Admin-managed Staff Users — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin create `admin` / `legal_unit` / `schedule_officer` users (never `applicant`) via an email-invite + set-password flow, manage officer office-scope, and grant `applicant` only to existing users.

**Architecture:** New Nitro server routes under `app/server/api/admin/users/` and `app/server/api/auth/`, new Zod schemas in `validators.ts`, a new email template, and admin UI in `pages/admin/users.vue` + a new `pages/auth/accept-invite.vue`. **No Prisma schema change** — reuses the many-to-many `UserRole`, `UserCollectionOffice`, and `PasswordResetToken` models, and the existing `POST /api/auth/reset-password` endpoint/page for the password step.

**Tech Stack:** Nuxt 4 / Nitro, Prisma (Postgres), Zod, vitest (unit + integration against real Postgres), bcryptjs, nodemailer, Playwright.

**Spec:** `docs/superpowers/specs/2026-06-07-admin-staff-user-management-design.md`

---

## File Structure

**Create:**
- `app/server/api/admin/users/index.post.ts` — create staff user + invite
- `app/server/api/admin/users/[id]/offices.put.ts` — replace a user's office scope
- `app/server/api/admin/users/[id]/resend-invite.post.ts` — regenerate + resend invite
- `app/server/api/auth/accept-invite.post.ts` — verify email from invite token (does NOT consume it)
- `app/server/emails/staff-invite.ts` — invite email template
- `app/pages/auth/accept-invite.vue` — verify-then-set-password landing page
- `app/test/admin-user-schemas.test.ts` — unit tests for the new Zod schemas
- `app/test/integration/admin-create-user.test.ts` — integration tests for the new handlers

**Modify:**
- `app/server/utils/validators.ts` — add `STAFF_ASSIGNABLE_ROLES`, `adminCreateUserSchema`, `adminUserOfficesSchema`, `acceptInviteSchema`
- `app/server/utils/audit.ts` — add `USER_CREATED`, `USER_INVITED`, `OFFICE_ASSIGN` actions
- `app/server/emails/index.ts` — register `staff-invite` template + add to `EmailTemplate` union
- `app/server/services/email.service.ts` — add `sendStaffInviteEmail`
- `app/server/middleware/auth.ts` — allow `/api/auth/accept-invite` as a public route
- `app/server/api/admin/users/[id]/roles.put.ts` — add self-lockout guard
- `app/server/api/admin/users/index.get.ts` — include `assignedOffices` + derive `activated` flag in the response
- `app/test/email.service.test.ts` — add `staff-invite` to the template smoke list
- `app/pages/admin/users.vue` — create-user modal, offices editor, applicant toggle, pending badge, resend action

> All `npm`/`npx`/`prisma`/`vitest` commands run from `app/`.

---

## Task 1: New Zod schemas + unit tests

**Files:**
- Modify: `app/server/utils/validators.ts` (add near the other `adminUser*` schemas, ~line 315)
- Test: `app/test/admin-user-schemas.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/test/admin-user-schemas.test.ts`:

```ts
import { describe, expect, it } from "vitest";

const { adminCreateUserSchema, adminUserOfficesSchema, acceptInviteSchema } =
  await import("~/server/utils/validators");

const officeId = "11111111-1111-1111-1111-111111111111";

describe("adminCreateUserSchema", () => {
  it("accepts a legal_unit user with no offices", () => {
    const r = adminCreateUserSchema.safeParse({
      email: "legal@adla.gov.gh",
      roleNames: ["legal_unit"],
    });
    expect(r.success).toBe(true);
  });

  it("rejects the applicant role (cannot be created by admin)", () => {
    const r = adminCreateUserSchema.safeParse({
      email: "x@adla.gov.gh",
      roleNames: ["applicant"],
    });
    expect(r.success).toBe(false);
  });

  it("requires at least one office for a schedule_officer", () => {
    const r = adminCreateUserSchema.safeParse({
      email: "officer@adla.gov.gh",
      roleNames: ["schedule_officer"],
      collectionOfficeIds: [],
    });
    expect(r.success).toBe(false);
  });

  it("accepts a schedule_officer with an office", () => {
    const r = adminCreateUserSchema.safeParse({
      email: "officer@adla.gov.gh",
      roleNames: ["schedule_officer"],
      collectionOfficeIds: [officeId],
    });
    expect(r.success).toBe(true);
  });

  it("rejects offices assigned to a non-officer", () => {
    const r = adminCreateUserSchema.safeParse({
      email: "legal@adla.gov.gh",
      roleNames: ["legal_unit"],
      collectionOfficeIds: [officeId],
    });
    expect(r.success).toBe(false);
  });

  it("requires at least one role", () => {
    const r = adminCreateUserSchema.safeParse({ email: "x@adla.gov.gh", roleNames: [] });
    expect(r.success).toBe(false);
  });
});

describe("adminUserOfficesSchema", () => {
  it("accepts an empty office list (clearing scope)", () => {
    expect(adminUserOfficesSchema.safeParse({ collectionOfficeIds: [] }).success).toBe(true);
  });
  it("rejects non-uuid office ids", () => {
    expect(adminUserOfficesSchema.safeParse({ collectionOfficeIds: ["nope"] }).success).toBe(false);
  });
});

describe("acceptInviteSchema", () => {
  it("requires a token", () => {
    expect(acceptInviteSchema.safeParse({ token: "" }).success).toBe(false);
    expect(acceptInviteSchema.safeParse({ token: "abc" }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/admin-user-schemas.test.ts`
Expected: FAIL — `adminCreateUserSchema` / `adminUserOfficesSchema` / `acceptInviteSchema` are `undefined` (not exported yet).

- [ ] **Step 3: Add the schemas**

In `app/server/utils/validators.ts`, after the `adminUserStatusSchema` block (~line 321), add:

```ts
/**
 * Roles an admin may assign when CREATING a user. `applicant` is deliberately
 * excluded — applicants self-register; admins can only add the applicant role
 * to an EXISTING user via the roles endpoint.
 */
export const STAFF_ASSIGNABLE_ROLES = ["admin", "legal_unit", "schedule_officer"] as const;

export const adminCreateUserSchema = z
  .object({
    email: z.string().email("Invalid email address"),
    phone: z
      .string()
      .regex(e164PhoneRegex, "Invalid phone number — include country code, e.g. +14155551234")
      .optional(),
    roleNames: z.array(z.enum(STAFF_ASSIGNABLE_ROLES)).min(1, "Select at least one role"),
    collectionOfficeIds: z.array(z.string().uuid()).default([]),
  })
  .superRefine((val, ctx) => {
    const isOfficer = val.roleNames.includes("schedule_officer");
    if (isOfficer && val.collectionOfficeIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["collectionOfficeIds"],
        message: "Assign at least one collection office for a schedule officer",
      });
    }
    if (!isOfficer && val.collectionOfficeIds.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["collectionOfficeIds"],
        message: "Only schedule officers can be assigned collection offices",
      });
    }
  });

export const adminUserOfficesSchema = z.object({
  collectionOfficeIds: z.array(z.string().uuid()),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1, "Token is required"),
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/admin-user-schemas.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add app/server/utils/validators.ts app/test/admin-user-schemas.test.ts
git commit -m "feat(validators): admin staff-user creation + office + invite schemas"
```

---

## Task 2: Audit actions

**Files:**
- Modify: `app/server/utils/audit.ts` (the `AuditActions` object, ~line 87-173)

- [ ] **Step 1: Add the actions**

In `app/server/utils/audit.ts`, inside the `AuditActions` object (near the other `USER_*` / `OFFICE_*` entries), add:

```ts
  USER_CREATED: "user_created",
  USER_INVITED: "user_invited",
  OFFICE_ASSIGN: "office_assign",
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx nuxi typecheck` (from `app/`)
Expected: no new errors from `audit.ts`. (`AuditAction` is derived via `typeof AuditActions[keyof ...]`, so the new keys are picked up automatically.)

- [ ] **Step 3: Commit**

```bash
git add app/server/utils/audit.ts
git commit -m "feat(audit): add USER_CREATED, USER_INVITED, OFFICE_ASSIGN actions"
```

---

## Task 3: Staff-invite email template + service helper

**Files:**
- Create: `app/server/emails/staff-invite.ts`
- Modify: `app/server/emails/index.ts`
- Modify: `app/server/services/email.service.ts`
- Test: `app/test/email.service.test.ts`

- [ ] **Step 1: Write the failing test**

In `app/test/email.service.test.ts`, add `"staff-invite"` to the `allTemplates` array (so the smoke test renders it), and add a focused test below the existing `it("interpolates ...")` cases:

```ts
  it("interpolates the accept-invite URL into the staff-invite email", () => {
    const html = generateEmailHtml("staff-invite", {
      name: "Jane",
      roleLabels: "Legal Unit",
      inviteUrl: "https://example.com/auth/accept-invite?token=abc",
    });
    expect(html).toContain("https://example.com/auth/accept-invite?token=abc");
    expect(html).toContain("Legal Unit");
  });
```

Also add `inviteUrl` and `roleLabels` to the shared `data` object inside the `it.each(allTemplates)` smoke test so the new template renders cleanly:

```ts
      inviteUrl: "https://example.com/auth/accept-invite?token=abc",
      roleLabels: "Legal Unit",
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/email.service.test.ts`
Expected: FAIL — `"staff-invite"` is not a known `EmailTemplate`, the renderer falls back to `welcome`, and the URL/`Legal Unit` assertions fail.

- [ ] **Step 3: Create the template**

Create `app/server/emails/staff-invite.ts`:

```ts
import { esc, layout, type TemplateRenderer } from "./layout";

export const staffInvite: TemplateRenderer = (data) =>
  layout({
    title: "Activate your ADLA staff account",
    body: `
      <p>Dear ${esc(data.name || "Colleague")},</p>
      <p>An administrator has created an ADLA account for you with the following role(s): <strong>${esc(data.roleLabels || "Staff")}</strong>.</p>
      <p>Click the button below to verify your email and set your password:</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${esc(data.inviteUrl)}" class="button">Activate Account</a>
      </p>
      <p>This link will expire in 72 hours. If it has expired, ask an administrator to resend your invitation.</p>
      <p>If you were not expecting this email, please ignore it.</p>
    `,
  });
```

- [ ] **Step 4: Register the template**

In `app/server/emails/index.ts`:
1. Add the import alongside the others: `import { staffInvite } from "./staff-invite";`
2. Add `| "staff-invite"` to the `EmailTemplate` union.
3. Add `"staff-invite": staffInvite,` to the `TEMPLATES` record.

- [ ] **Step 5: Add the service helper**

In `app/server/services/email.service.ts`, after `sendPasswordResetEmail`:

```ts
/**
 * Send a staff-account invitation. The link points at /auth/accept-invite,
 * which verifies the email then hands off to the set-password form.
 */
export async function sendStaffInviteEmail(
  to: string,
  roleLabels: string,
  token: string
): Promise<boolean> {
  const config = useRuntimeConfig();
  return sendEmail({
    to,
    subject: "Activate your ADLA staff account",
    template: "staff-invite",
    data: {
      name: to,
      roleLabels,
      inviteUrl: `${config.public.appUrl}/auth/accept-invite?token=${token}`,
    },
  });
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run test/email.service.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/server/emails/staff-invite.ts app/server/emails/index.ts app/server/services/email.service.ts app/test/email.service.test.ts
git commit -m "feat(email): staff-invite template and sendStaffInviteEmail helper"
```

---

## Task 4: `POST /api/admin/users` — create staff user + invite

**Files:**
- Create: `app/server/api/admin/users/index.post.ts`
- Test: `app/test/integration/admin-create-user.test.ts`

> Integration tests run real handlers against `TEST_DATABASE_URL`. POST handlers read the body via `readBody`, which the integration setup does not stub — so the test file stubs it itself via a mutable holder.

- [ ] **Step 1: Write the failing test**

Create `app/test/integration/admin-create-user.test.ts`:

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "~/server/utils/prisma";

// Mutable body the stubbed readBody returns; set before each handler call.
let currentBody: unknown = {};
vi.stubGlobal("readBody", async () => currentBody);
// email + token generation must not actually send mail; stub the transport-facing helper.
vi.mock("~/server/services/email.service", () => ({
  sendStaffInviteEmail: vi.fn(async () => true),
}));

const createUser = (await import("~/server/api/admin/users/index.post")).default;

const TABLES = [
  "password_reset_tokens",
  "user_collection_offices",
  "notification_preferences",
  "user_roles",
  "users",
  "collection_offices",
  "roles",
];

async function reset() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`,
  );
}

let adminId: string;
let hqOfficeId: string;

beforeAll(async () => {
  await reset();
  await prisma.role.createMany({
    data: [
      { name: "admin" },
      { name: "legal_unit" },
      { name: "schedule_officer" },
      { name: "applicant" },
    ],
  });
  const admin = await prisma.user.create({
    data: { email: "admin@adla.test", passwordHash: "x", emailVerified: true },
  });
  adminId = admin.id;
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "admin" } });
  await prisma.userRole.create({ data: { userId: admin.id, roleId: adminRole.id } });
  const office = await prisma.collectionOffice.create({
    data: { name: "GAS HQ", type: "HEADQUARTERS" },
  });
  hqOfficeId = office.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

const adminEvent = () =>
  ({ context: { auth: { userId: adminId, roles: ["admin"] } } }) as never;

describe("POST /api/admin/users", () => {
  it("creates a legal_unit user with an unusable password, unverified email, and a 72h invite token", async () => {
    currentBody = { email: "newlegal@adla.test", roleNames: ["legal_unit"] };
    const res = await createUser(adminEvent());
    expect(res.success).toBe(true);

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: "newlegal@adla.test" },
      include: { roles: { include: { role: true } } },
    });
    expect(user.emailVerified).toBe(false);
    expect(user.isActive).toBe(true);
    expect(user.passwordHash.length).toBeGreaterThan(0);
    expect(user.roles.map((r) => r.role.name)).toEqual(["legal_unit"]);

    const token = await prisma.passwordResetToken.findFirstOrThrow({ where: { userId: user.id } });
    const hoursOut = (token.expiresAt.getTime() - Date.now()) / 3_600_000;
    expect(hoursOut).toBeGreaterThan(71);
    expect(hoursOut).toBeLessThan(73);
  });

  it("creates a schedule_officer scoped to the given office", async () => {
    currentBody = {
      email: "newofficer@adla.test",
      roleNames: ["schedule_officer"],
      collectionOfficeIds: [hqOfficeId],
    };
    await createUser(adminEvent());
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: "newofficer@adla.test" },
      include: { assignedOffices: true },
    });
    expect(user.assignedOffices.map((o) => o.collectionOfficeId)).toEqual([hqOfficeId]);
  });

  it("rejects a duplicate email with 409", async () => {
    currentBody = { email: "newlegal@adla.test", roleNames: ["legal_unit"] };
    await expect(createUser(adminEvent())).rejects.toMatchObject({ statusCode: 409 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `TEST_DATABASE_URL=postgresql://adla:adla@localhost:5432/adla_test npx vitest run --config vitest.integration.config.ts test/integration/admin-create-user.test.ts`
Expected: FAIL — handler module does not exist.

- [ ] **Step 3: Implement the handler**

Create `app/server/api/admin/users/index.post.ts`:

```ts
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import prisma from "~/server/utils/prisma";
import { validateBody, adminCreateUserSchema } from "~/server/utils/validators";
import { createAuditLog, AuditActions } from "~/server/utils/audit";
import { generateResetToken } from "~/server/utils/code-generator";
import { sendStaffInviteEmail } from "~/server/services/email.service";
import { ghanaPhoneAlternates, isGhanaPhone, normalizePhoneE164 } from "~/server/utils/phone";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  legal_unit: "Legal Unit",
  schedule_officer: "Schedule Officer",
};

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const { email, phone, roleNames, collectionOfficeIds } = await validateBody(
    event,
    adminCreateUserSchema,
  );

  const normalizedPhone = phone ? (normalizePhoneE164(phone) ?? undefined) : undefined;

  // Uniqueness — mirror register.post.ts.
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    throw createError({
      statusCode: 409,
      statusMessage: "Conflict",
      message: "An account with this email already exists",
    });
  }
  if (normalizedPhone) {
    const candidates = isGhanaPhone(normalizedPhone)
      ? ghanaPhoneAlternates(normalizedPhone)
      : [normalizedPhone];
    const phoneOwner = await prisma.user.findFirst({
      where: { phone: { in: candidates } },
      select: { id: true },
    });
    if (phoneOwner) {
      throw createError({
        statusCode: 409,
        statusMessage: "Conflict",
        data: {
          fieldErrors: { phone: ["This phone number is already registered"] },
          formErrors: [],
        },
      });
    }
  }

  // Resolve role names → ids.
  const roles = await prisma.role.findMany({ where: { name: { in: roleNames } } });
  if (roles.length !== roleNames.length) {
    throw createError({
      statusCode: 500,
      statusMessage: "Internal Server Error",
      message: "System configuration error: one or more roles not found",
    });
  }

  // Validate offices exist (only relevant for schedule_officer; schema guarantees
  // the array is empty for non-officers).
  if (collectionOfficeIds.length > 0) {
    const count = await prisma.collectionOffice.count({
      where: { id: { in: collectionOfficeIds }, isActive: true },
    });
    if (count !== collectionOfficeIds.length) {
      throw createError({
        statusCode: 400,
        statusMessage: "Bad Request",
        message: "One or more selected collection offices do not exist",
      });
    }
  }

  // Unusable password — the invitee sets a real one via the invite link.
  // bcrypt cost 13 matches register/reset so future logins compare correctly.
  const passwordHash = await bcrypt.hash(randomUUID(), 13);

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      phone: normalizedPhone,
      emailVerified: false,
      isActive: true,
      roles: { create: roles.map((r) => ({ roleId: r.id })) },
      assignedOffices: {
        create: collectionOfficeIds.map((id) => ({ collectionOfficeId: id })),
      },
      notificationPrefs: {
        create: { emailEnabled: true, smsEnabled: true, inAppEnabled: true },
      },
    },
  });

  // 72h invite token (reuses PasswordResetToken + reset-password flow).
  const token = generateResetToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 72);
  await prisma.passwordResetToken.create({
    data: { userId: user.id, token, expiresAt },
  });

  await createAuditLog(event, {
    userId: auth.userId,
    action: AuditActions.USER_CREATED,
    entityType: "user",
    entityId: user.id,
    newValues: { email: user.email, roles: roleNames, collectionOfficeIds },
  });

  const roleLabels = roleNames.map((r) => ROLE_LABELS[r] ?? r).join(", ");
  try {
    await sendStaffInviteEmail(user.email, roleLabels, token);
  } catch (e) {
    console.error("Failed to send staff invite email:", e);
  }

  return {
    success: true,
    message: "Staff user created and invitation sent",
    data: {
      id: user.id,
      email: user.email,
      phone: user.phone,
      roles: roleNames,
      collectionOfficeIds,
    },
  };
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `TEST_DATABASE_URL=postgresql://adla:adla@localhost:5432/adla_test npx vitest run --config vitest.integration.config.ts test/integration/admin-create-user.test.ts`
Expected: PASS (all 3 cases).

- [ ] **Step 5: Commit**

```bash
git add app/server/api/admin/users/index.post.ts app/test/integration/admin-create-user.test.ts
git commit -m "feat(admin): create staff users with email invite"
```

---

## Task 5: `POST /api/auth/accept-invite` — verify email from invite token

**Files:**
- Create: `app/server/api/auth/accept-invite.post.ts`
- Modify: `app/server/middleware/auth.ts` (publicRoutes, ~line 12-23)
- Test: `app/test/integration/admin-create-user.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Append to `app/test/integration/admin-create-user.test.ts` (inside the file, after the create describe block). Add the handler import at the top with the others:

```ts
const acceptInvite = (await import("~/server/api/auth/accept-invite.post")).default;
```

Then add:

```ts
describe("POST /api/auth/accept-invite", () => {
  async function createInvitee(email: string) {
    currentBody = { email, roleNames: ["legal_unit"] };
    await createUser(adminEvent());
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const token = await prisma.passwordResetToken.findFirstOrThrow({ where: { userId: user.id } });
    return { user, token };
  }

  const publicEvent = () => ({ context: {} }) as never;

  it("marks the email verified and leaves the token unconsumed", async () => {
    const { user, token } = await createInvitee("invitee1@adla.test");
    currentBody = { token: token.token };
    const res = await acceptInvite(publicEvent());
    expect(res.success).toBe(true);
    expect(res.email).toBe("invitee1@adla.test");

    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.emailVerified).toBe(true);
    const tokenAfter = await prisma.passwordResetToken.findUniqueOrThrow({
      where: { id: token.id },
    });
    expect(tokenAfter.usedAt).toBeNull();
  });

  it("rejects an unknown token", async () => {
    currentBody = { token: "does-not-exist" };
    await expect(acceptInvite(publicEvent())).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects an expired token", async () => {
    const { token } = await createInvitee("invitee2@adla.test");
    await prisma.passwordResetToken.update({
      where: { id: token.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    currentBody = { token: token.token };
    await expect(acceptInvite(publicEvent())).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects an already-used token", async () => {
    const { token } = await createInvitee("invitee3@adla.test");
    await prisma.passwordResetToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    });
    currentBody = { token: token.token };
    await expect(acceptInvite(publicEvent())).rejects.toMatchObject({ statusCode: 400 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `TEST_DATABASE_URL=postgresql://adla:adla@localhost:5432/adla_test npx vitest run --config vitest.integration.config.ts test/integration/admin-create-user.test.ts`
Expected: FAIL — `accept-invite.post` module does not exist.

- [ ] **Step 3: Implement the handler**

Create `app/server/api/auth/accept-invite.post.ts`:

```ts
import prisma from "~/server/utils/prisma";
import { validateBody, acceptInviteSchema } from "~/server/utils/validators";

/**
 * Step 1 of the staff-invite flow. Validates the invite token (a
 * PasswordResetToken) and marks the user's email verified — but does NOT
 * consume the token. The set-password form then posts the same token to
 * /api/auth/reset-password, which consumes it.
 */
export default defineEventHandler(async (event) => {
  const { token } = await validateBody(event, acceptInviteSchema);

  const inviteToken = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: true },
  });

  const invalid = () =>
    createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "This invitation link is invalid or has expired. Ask an administrator to resend it.",
    });

  if (!inviteToken) throw invalid();
  if (inviteToken.expiresAt < new Date()) throw invalid();
  if (inviteToken.usedAt) throw invalid();

  if (!inviteToken.user.emailVerified) {
    await prisma.user.update({
      where: { id: inviteToken.userId },
      data: { emailVerified: true },
    });
  }

  return { success: true, email: inviteToken.user.email };
});
```

- [ ] **Step 4: Make the route public**

In `app/server/middleware/auth.ts`, add to the `publicRoutes` array (next to the other `/api/auth/*` entries):

```ts
  "/api/auth/accept-invite",
```

- [ ] **Step 5: Run test to verify it passes**

Run: `TEST_DATABASE_URL=postgresql://adla:adla@localhost:5432/adla_test npx vitest run --config vitest.integration.config.ts test/integration/admin-create-user.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/server/api/auth/accept-invite.post.ts app/server/middleware/auth.ts app/test/integration/admin-create-user.test.ts
git commit -m "feat(auth): accept-invite endpoint verifies email without consuming token"
```

---

## Task 6: `PUT /api/admin/users/[id]/offices` — manage officer scope

**Files:**
- Create: `app/server/api/admin/users/[id]/offices.put.ts`
- Test: `app/test/integration/admin-create-user.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Add the import at the top of the integration test file:

```ts
const updateOffices = (await import("~/server/api/admin/users/[id]/offices.put")).default;
```

Add a describe block. Note `getRouterParam` is read via the h3 global; stub it per-call with a mutable holder near the top of the file (next to `currentBody`):

```ts
let currentRouteId = "";
vi.stubGlobal("getRouterParam", () => currentRouteId);
```

```ts
describe("PUT /api/admin/users/[id]/offices", () => {
  it("replaces a user's collection-office assignments", async () => {
    currentBody = {
      email: "officer2@adla.test",
      roleNames: ["schedule_officer"],
      collectionOfficeIds: [hqOfficeId],
    };
    await createUser(adminEvent());
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "officer2@adla.test" } });

    const other = await prisma.collectionOffice.create({
      data: { name: "Kumasi Regional", type: "REGIONAL", region: "Ashanti" },
    });

    currentRouteId = user.id;
    currentBody = { collectionOfficeIds: [other.id] };
    const res = await updateOffices(adminEvent());
    expect(res.success).toBe(true);

    const after = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { assignedOffices: true },
    });
    expect(after.assignedOffices.map((o) => o.collectionOfficeId)).toEqual([other.id]);
  });

  it("clears scope when given an empty list", async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "officer2@adla.test" } });
    currentRouteId = user.id;
    currentBody = { collectionOfficeIds: [] };
    await updateOffices(adminEvent());
    const after = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { assignedOffices: true },
    });
    expect(after.assignedOffices).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `TEST_DATABASE_URL=postgresql://adla:adla@localhost:5432/adla_test npx vitest run --config vitest.integration.config.ts test/integration/admin-create-user.test.ts`
Expected: FAIL — `offices.put` module does not exist.

- [ ] **Step 3: Implement the handler**

Create `app/server/api/admin/users/[id]/offices.put.ts`:

```ts
import prisma from "~/server/utils/prisma";
import { logAction } from "~/server/utils/audit";
import { validateBody, adminUserOfficesSchema } from "~/server/utils/validators";

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const userId = getRouterParam(event, "id");
  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: "User ID is required" });
  }

  const { collectionOfficeIds } = await validateBody(event, adminUserOfficesSchema);

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { assignedOffices: true },
  });
  if (!targetUser) {
    throw createError({ statusCode: 404, statusMessage: "User not found" });
  }

  if (collectionOfficeIds.length > 0) {
    const count = await prisma.collectionOffice.count({
      where: { id: { in: collectionOfficeIds }, isActive: true },
    });
    if (count !== collectionOfficeIds.length) {
      throw createError({
        statusCode: 400,
        statusMessage: "Bad Request",
        message: "One or more selected collection offices do not exist",
      });
    }
  }

  const oldOffices = targetUser.assignedOffices.map((o) => o.collectionOfficeId);

  await prisma.$transaction([
    prisma.userCollectionOffice.deleteMany({ where: { userId } }),
    prisma.userCollectionOffice.createMany({
      data: collectionOfficeIds.map((collectionOfficeId) => ({ userId, collectionOfficeId })),
    }),
  ]);

  await logAction({
    userId: auth.userId,
    action: "office_assign",
    entityType: "User",
    entityId: userId,
    oldValues: { collectionOfficeIds: oldOffices },
    newValues: { collectionOfficeIds },
    event,
  });

  return { success: true, message: "Office assignments updated" };
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `TEST_DATABASE_URL=postgresql://adla:adla@localhost:5432/adla_test npx vitest run --config vitest.integration.config.ts test/integration/admin-create-user.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/server/api/admin/users/[id]/offices.put.ts" app/test/integration/admin-create-user.test.ts
git commit -m "feat(admin): manage user collection-office scope"
```

---

## Task 7: Self-lockout guard on the roles endpoint

**Files:**
- Modify: `app/server/api/admin/users/[id]/roles.put.ts`
- Test: `app/test/integration/admin-create-user.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Add the import at the top of the integration test file:

```ts
const updateRoles = (await import("~/server/api/admin/users/[id]/roles.put")).default;
```

Add:

```ts
describe("PUT /api/admin/users/[id]/roles (self-lockout guard)", () => {
  it("blocks an admin from removing their own admin role", async () => {
    const legalRole = await prisma.role.findUniqueOrThrow({ where: { name: "legal_unit" } });
    currentRouteId = adminId;
    currentBody = { roleIds: [legalRole.id] };
    await expect(updateRoles(adminEvent())).rejects.toMatchObject({ statusCode: 400 });
  });

  it("allows granting applicant to an existing user", async () => {
    const applicantRole = await prisma.role.findUniqueOrThrow({ where: { name: "applicant" } });
    const legalRole = await prisma.role.findUniqueOrThrow({ where: { name: "legal_unit" } });
    currentBody = { email: "dual@adla.test", roleNames: ["legal_unit"] };
    await createUser(adminEvent());
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "dual@adla.test" } });

    currentRouteId = user.id;
    currentBody = { roleIds: [legalRole.id, applicantRole.id] };
    const res = await updateRoles(adminEvent());
    expect(res.success).toBe(true);

    const after = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { roles: { include: { role: true } } },
    });
    expect(after.roles.map((r) => r.role.name).sort()).toEqual(["applicant", "legal_unit"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `TEST_DATABASE_URL=postgresql://adla:adla@localhost:5432/adla_test npx vitest run --config vitest.integration.config.ts test/integration/admin-create-user.test.ts`
Expected: FAIL — the self-lockout case currently succeeds (no guard yet).

- [ ] **Step 3: Add the guard**

In `app/server/api/admin/users/[id]/roles.put.ts`, after `const { roleIds } = await validateBody(...)` and after `targetUser` is fetched, **before** the `$transaction`, fetch the resulting role records and add the guard. Replace the existing block that builds `newRoles` after the transaction so the names are available up front:

```ts
  const { roleIds } = await validateBody(event, adminUserRolesSchema);

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { roles: { include: { role: true } } },
  });

  if (!targetUser) {
    throw createError({ statusCode: 404, statusMessage: "User not found" });
  }

  const oldRoles = targetUser.roles.map((r) => r.role.name);

  // Resolve the requested role records up front so we can both guard and audit.
  const newRoleRecords = await prisma.role.findMany({ where: { id: { in: roleIds } } });
  const newRoleNames = newRoleRecords.map((r) => r.name);

  // Self-lockout guard: an admin cannot strip their own admin role.
  if (userId === auth.userId && !newRoleNames.includes("admin")) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "You cannot remove your own admin role",
    });
  }

  await prisma.$transaction([
    prisma.userRole.deleteMany({ where: { userId } }),
    prisma.userRole.createMany({
      data: roleIds.map((roleId) => ({ userId, roleId })),
    }),
  ]);

  await logAction({
    userId: auth.userId,
    action: "ROLE_ASSIGN",
    entityType: "User",
    entityId: userId,
    oldValues: { roles: oldRoles },
    newValues: { roles: newRoleNames },
    event,
  });
```

Delete the now-redundant post-transaction `const newRoles = await prisma.role.findMany(...)` block that the original handler used to build the audit payload.

- [ ] **Step 4: Run test to verify it passes**

Run: `TEST_DATABASE_URL=postgresql://adla:adla@localhost:5432/adla_test npx vitest run --config vitest.integration.config.ts test/integration/admin-create-user.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/server/api/admin/users/[id]/roles.put.ts" app/test/integration/admin-create-user.test.ts
git commit -m "feat(admin): block admins from removing their own admin role"
```

---

## Task 8: `POST /api/admin/users/[id]/resend-invite`

**Files:**
- Create: `app/server/api/admin/users/[id]/resend-invite.post.ts`
- Test: `app/test/integration/admin-create-user.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Add the import:

```ts
const resendInvite = (await import("~/server/api/admin/users/[id]/resend-invite.post")).default;
```

Add:

```ts
describe("POST /api/admin/users/[id]/resend-invite", () => {
  it("replaces the existing invite token with a fresh 72h token", async () => {
    currentBody = { email: "resend@adla.test", roleNames: ["legal_unit"] };
    await createUser(adminEvent());
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "resend@adla.test" } });
    const first = await prisma.passwordResetToken.findFirstOrThrow({ where: { userId: user.id } });

    currentRouteId = user.id;
    const res = await resendInvite(adminEvent());
    expect(res.success).toBe(true);

    const tokens = await prisma.passwordResetToken.findMany({ where: { userId: user.id } });
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.token).not.toBe(first.token);
    const hoursOut = (tokens[0]!.expiresAt.getTime() - Date.now()) / 3_600_000;
    expect(hoursOut).toBeGreaterThan(71);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `TEST_DATABASE_URL=postgresql://adla:adla@localhost:5432/adla_test npx vitest run --config vitest.integration.config.ts test/integration/admin-create-user.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the handler**

Create `app/server/api/admin/users/[id]/resend-invite.post.ts`:

```ts
import prisma from "~/server/utils/prisma";
import { logAction } from "~/server/utils/audit";
import { generateResetToken } from "~/server/utils/code-generator";
import { sendStaffInviteEmail } from "~/server/services/email.service";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  legal_unit: "Legal Unit",
  schedule_officer: "Schedule Officer",
};

export default defineEventHandler(async (event) => {
  const auth = event.context.auth;
  if (!auth) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const userId = getRouterParam(event, "id");
  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: "User ID is required" });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { roles: { include: { role: true } } },
  });
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: "User not found" });
  }

  // Fresh 72h token; drop any prior tokens for this user.
  const token = generateResetToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 72);
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId } }),
    prisma.passwordResetToken.create({ data: { userId, token, expiresAt } }),
  ]);

  await logAction({
    userId: auth.userId,
    action: "user_invited",
    entityType: "User",
    entityId: userId,
    event,
  });

  const roleLabels = user.roles.map((r) => ROLE_LABELS[r.role.name] ?? r.role.name).join(", ");
  try {
    await sendStaffInviteEmail(user.email, roleLabels, token);
  } catch (e) {
    console.error("Failed to resend staff invite email:", e);
  }

  return { success: true, message: "Invitation resent" };
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `TEST_DATABASE_URL=postgresql://adla:adla@localhost:5432/adla_test npx vitest run --config vitest.integration.config.ts test/integration/admin-create-user.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/server/api/admin/users/[id]/resend-invite.post.ts" app/test/integration/admin-create-user.test.ts
git commit -m "feat(admin): resend staff invitation"
```

---

## Task 9: Surface offices + activation state in the users list

**Files:**
- Modify: `app/server/api/admin/users/index.get.ts`

- [ ] **Step 1: Add `assignedOffices` to the select**

In `app/server/api/admin/users/index.get.ts`, inside the `select` of `prisma.user.findMany`, after `roles: { include: { role: true } },` add:

```ts
        assignedOffices: {
          select: {
            collectionOffice: { select: { id: true, name: true, type: true, region: true } },
          },
        },
```

- [ ] **Step 2: Include offices + an `activated` flag in the mapped response**

In the `users.map(...)` return object, after `roles: user.roles.map((r) => r.role.name),` add:

```ts
        collectionOffices: user.assignedOffices.map((a) => a.collectionOffice),
        // "Invitation pending" = staff account created but email not yet verified
        // via the invite link. (Applicants are never created here.)
        activated: user.emailVerified,
```

- [ ] **Step 3: Verify typecheck + existing tests still pass**

Run: `npx nuxi typecheck`
Run: `npx vitest run test/admin-declarations-shape.test.ts` (sanity — unrelated, should stay green)
Expected: no new type errors.

- [ ] **Step 4: Commit**

```bash
git add app/server/api/admin/users/index.get.ts
git commit -m "feat(admin): expose collection offices and activation state in users list"
```

---

## Task 10: `pages/auth/accept-invite.vue` — verify then set password

**Files:**
- Create: `app/pages/auth/accept-invite.vue`
- Reference: `app/pages/auth/reset-password.vue` (copy the password form + submit logic), `app/pages/auth/verify-email.vue` (copy the token-from-query + status pattern)

- [ ] **Step 1: Read the two reference pages**

Run: `sed -n '1,200p' app/pages/auth/reset-password.vue` and `sed -n '1,200p' app/pages/auth/verify-email.vue`
Purpose: reuse their `layout: "auth"` meta, the `useRoute().query.token` read, the password+confirm fields with the same validation messaging, and the `$fetch("/api/auth/reset-password", { method: "POST", body: { token, password } })` call. Match their styling/components exactly.

- [ ] **Step 2: Implement the page**

Create `app/pages/auth/accept-invite.vue`. Behaviour:
1. `definePageMeta({ layout: "auth" })`.
2. On mount, read `token` from `useRoute().query`. If missing → show an error state ("Invalid invitation link").
3. Call `await $fetch("/api/auth/accept-invite", { method: "POST", body: { token } })`.
   - On error → `status.value = "error"`, show the server message and a line telling them to ask an admin to resend.
   - On success → store `email` from the response, set `status.value = "ready"`, reveal the set-password form.
4. The set-password form mirrors `reset-password.vue`: `password` + `confirmPassword`, same client-side checks (≥8 chars, upper/lower/number, match), submit posts to `POST /api/auth/reset-password` with `{ token, password }`.
5. On password success → toast/inline success and `navigateTo("/auth/login")`.

Use the same UI components (`Card`, `Button`, `Input`, etc.) and error-display approach the reset-password page uses — do not invent new patterns. Keep the password-strength validation copy identical to `resetPasswordSchema`'s messages so client and server agree.

> This page is reachable while logged out. The two endpoints it calls
> (`/api/auth/accept-invite`, `/api/auth/reset-password`) are both in the
> middleware `publicRoutes` allow-list (accept-invite added in Task 5).

- [ ] **Step 3: Manual smoke (dev server)**

Run: `npm run dev`, then visit `http://localhost:3000/auth/accept-invite?token=BADTOKEN`.
Expected: the error state renders (no crash, no infinite spinner).

- [ ] **Step 4: Commit**

```bash
git add app/pages/auth/accept-invite.vue
git commit -m "feat(ui): accept-invite page verifies email then sets password"
```

---

## Task 11: `pages/admin/users.vue` — create modal, offices, applicant toggle, badges

**Files:**
- Modify: `app/pages/admin/users.vue`
- Reference: the existing roles-edit modal in the same file; `GET /api/admin/roles`, `GET /api/collection-offices`

- [ ] **Step 1: Read the current page**

Run: `sed -n '1,400p' app/pages/admin/users.vue`
Purpose: reuse the existing data-loading (`authFetch`/`useApiFetch`), the roles modal, the status toggle, toast usage, and table layout. Match them.

- [ ] **Step 2: Add a "Create user" modal**

Add a "Create user" button above the table opening a modal/dialog with:
- `email` (required), `phone` (optional),
- role checkboxes built from `GET /api/admin/roles` **filtered to** `admin`, `legal_unit`, `schedule_officer` (exclude `applicant` — it must not appear here),
- a `CollectionOffice` multi-select loaded from `GET /api/collection-offices`, shown **only** when `schedule_officer` is ticked and **required** in that case (disable submit / show inline error otherwise),
- submit → `POST /api/admin/users` with `{ email, phone?, roleNames, collectionOfficeIds }`. On success: toast "Invitation sent to <email>", close modal, refresh the list. On 409: show the email/phone conflict inline (the endpoint returns `data.fieldErrors` for phone, mirroring register).

- [ ] **Step 3: Extend the edit modal**

In the existing roles editor:
- Allow `applicant` to be toggled **on** for an existing user, with a helper note: "Applicants must complete their own Ghana Card profile before they can file a declaration." Keep saving via the existing `PUT /api/admin/users/[id]/roles`.
- Add an **Offices** section (visible when the user has, or is being given, `schedule_officer`) listing current `collectionOffices` (now returned by the list endpoint) with a multi-select; save via `PUT /api/admin/users/[id]/offices` with `{ collectionOfficeIds }`.

- [ ] **Step 4: Add the pending badge + resend action**

- In the table, render an "Invitation pending" badge for rows where `activated === false`.
- Add a "Resend invite" row action (visible when `activated === false`) calling `POST /api/admin/users/[id]/resend-invite`; on success toast "Invitation resent".

- [ ] **Step 5: Lint + manual smoke**

Run: `npm run lint`
Run: `npm run dev` → as the seeded admin (`admin@adla.gov.gh`), create a `legal_unit` user; confirm it appears with a "pending" badge and the applicant role is absent from the create form.
Expected: clean lint; create flow works end-to-end against the dev DB (check MailHog at `:8025` for the invite email).

- [ ] **Step 6: Commit**

```bash
git add app/pages/admin/users.vue
git commit -m "feat(ui): admin create staff users, manage offices, resend invites"
```

---

## Task 12: End-to-end test (Playwright)

**Files:**
- Create: `app/tests/e2e/admin-create-staff.spec.ts` (match the existing e2e directory/layout — confirm with `ls app/tests` / existing `playwright.config`)

- [ ] **Step 1: Inspect existing e2e setup**

Run: `ls app/tests/e2e 2>/dev/null; cat app/playwright.config.ts 2>/dev/null | head -40`
Purpose: reuse the base URL, auth/login helpers, and any seeded-admin login fixture the suite already uses. Follow that pattern exactly.

- [ ] **Step 2: Write the spec**

Create the spec covering the happy path:
1. Log in as the seeded admin (`admin@adla.gov.gh` / `password123` per the seed).
2. Go to `/admin/users`, open "Create user", create a `legal_unit` user with a unique email (e.g. `e2e-legal+<timestamp>@adla.test`).
3. Assert the new row shows an "Invitation pending" badge.
4. Retrieve the invite link. Preferred: query the test DB for the user's `PasswordResetToken` (reuse the integration DB helpers) and build `/auth/accept-invite?token=...`; alternative: read it from MailHog's API at `http://localhost:8025/api/v2/messages`.
5. Visit the invite link, assert it shows the set-password form, set a valid password, submit.
6. Log out, log in as the new user with that password — assert a successful authenticated landing.

Also add a negative check: open "Create user", tick `schedule_officer`, leave offices empty, assert submit is blocked / shows the office-required error.

- [ ] **Step 3: Run the e2e suite**

Run: `npm run test:e2e` (ensure the dev stack / seeded DB is up: `docker compose -f docker-compose.dev.yml up` from repo root, plus `npm run db:reset` in `app/` if needed).
Expected: the new spec passes.

- [ ] **Step 4: Commit**

```bash
git add app/tests/e2e/admin-create-staff.spec.ts
git commit -m "test(e2e): admin creates legal_unit user, invitee activates and logs in"
```

---

## Final verification

- [ ] **Run the full unit suite:** `npm run test:unit` → all pass.
- [ ] **Run the integration suite:** `TEST_DATABASE_URL=postgresql://adla:adla@localhost:5432/adla_test npm run test:integration` (or `npx vitest run --config vitest.integration.config.ts`) → all pass.
- [ ] **Typecheck:** `npx nuxi typecheck` → clean.
- [ ] **Lint:** `npm run lint` → clean.
- [ ] **Manual:** create one of each staff role; confirm `applicant` is never offered at create but can be toggled on an existing user; confirm an officer created without an office is rejected.

---

## Notes for the implementer

- **No Prisma migration** is part of this plan. If `npx prisma migrate status` shows drift, stop — something is off; the design relies on existing tables only.
- **`TEST_DATABASE_URL`** must point at a scratch Postgres with migrations applied (`prisma migrate deploy` against it). The integration suite truncates tables it touches.
- **bcrypt cost 13** is mandatory everywhere a password hash is written (register, reset, and the unusable hash here) so login comparisons stay consistent — see the comments in `register.post.ts` / `reset-password.post.ts`.
- **Role names**, not ids, are the stable contract in new code (`adminCreateUserSchema.roleNames`). The existing `roles.put.ts` still uses `roleIds` — leave that contract as-is to avoid touching the working roles modal.
- Every admin endpoint repeats an in-handler admin check even though `server/middleware/auth.ts` already gates `/api/admin/*` to the `admin` role — follow that established belt-and-suspenders pattern (see `status.patch.ts`). The create/offices/resend handlers above rely on the middleware prefix check plus the `auth` presence check; add an explicit in-handler `isAdmin` check if you want to match `roles.put.ts` exactly.
```
