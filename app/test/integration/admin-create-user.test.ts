import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import prisma from "~/server/utils/prisma";

// Mutable body the stubbed readBody returns; set before each handler call.
let currentBody: unknown = {};
vi.stubGlobal("readBody", async () => currentBody);
let currentRouteId = "";
vi.stubGlobal("getRouterParam", () => currentRouteId);
// email sending must not actually fire; stub the helper the handler imports.
vi.mock("~/server/services/email.service", () => ({
  sendStaffInviteEmail: vi.fn(async () => true),
}));

const createUser = (await import("~/server/api/admin/users/index.post")).default;
const acceptInvite = (await import("~/server/api/auth/accept-invite.post")).default;
const updateOffices = (await import("~/server/api/admin/users/[id]/offices.put")).default;

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

const updateRoles = (await import("~/server/api/admin/users/[id]/roles.put")).default;
const resendInvite = (await import("~/server/api/admin/users/[id]/resend-invite.post")).default;

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

  it("refuses to resend for an already-activated user", async () => {
    currentBody = { email: "activated@adla.test", roleNames: ["legal_unit"] };
    await createUser(adminEvent());
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "activated@adla.test" } });
    await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });

    currentRouteId = user.id;
    await expect(resendInvite(adminEvent())).rejects.toMatchObject({ statusCode: 409 });
  });
});
