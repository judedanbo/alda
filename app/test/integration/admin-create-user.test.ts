import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import prisma from "~/server/utils/prisma";

// Mutable body the stubbed readBody returns; set before each handler call.
let currentBody: unknown = {};
vi.stubGlobal("readBody", async () => currentBody);
// email sending must not actually fire; stub the helper the handler imports.
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
