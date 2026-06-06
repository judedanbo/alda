import { describe, it, expect, beforeEach, vi } from "vitest";
import bcrypt from "bcryptjs";
import { readBootstrapEnv, bootstrapAdmin } from "../prisma/bootstrap-admin";

const roleUpsert = vi.fn();
const userUpsert = vi.fn();
const notifUpsert = vi.fn();

const mockPrisma = {
  role: { upsert: roleUpsert },
  user: { upsert: userUpsert },
  notificationPreference: { upsert: notifUpsert },
} as unknown as Parameters<typeof bootstrapAdmin>[0];

beforeEach(() => {
  roleUpsert.mockReset().mockResolvedValue({ id: 1, name: "admin" });
  userUpsert.mockReset().mockResolvedValue({ id: "admin-uuid", email: "a@b.gov.gh" });
  notifUpsert.mockReset().mockResolvedValue({});
});

describe("readBootstrapEnv", () => {
  it("throws when the email is missing", () => {
    expect(() => readBootstrapEnv({ BOOTSTRAP_ADMIN_PASSWORD: "pw" })).toThrow(
      /BOOTSTRAP_ADMIN_EMAIL/,
    );
  });

  it("throws when the password is missing", () => {
    expect(() => readBootstrapEnv({ BOOTSTRAP_ADMIN_EMAIL: "a@b.gov.gh" })).toThrow(
      /BOOTSTRAP_ADMIN_PASSWORD/,
    );
  });

  it("returns trimmed email, password, and optional phone", () => {
    const opts = readBootstrapEnv({
      BOOTSTRAP_ADMIN_EMAIL: "  a@b.gov.gh ",
      BOOTSTRAP_ADMIN_PASSWORD: "secret-pw",
      BOOTSTRAP_ADMIN_PHONE: "+233200000000",
    });
    expect(opts).toEqual({
      email: "a@b.gov.gh",
      password: "secret-pw",
      phone: "+233200000000",
    });
  });

  it("throws when the email is whitespace-only", () => {
    expect(() =>
      readBootstrapEnv({ BOOTSTRAP_ADMIN_EMAIL: "   ", BOOTSTRAP_ADMIN_PASSWORD: "pw" }),
    ).toThrow(/BOOTSTRAP_ADMIN_EMAIL/);
  });

  it("omits the phone key entirely when BOOTSTRAP_ADMIN_PHONE is absent", () => {
    expect(
      readBootstrapEnv({ BOOTSTRAP_ADMIN_EMAIL: "a@b.gov.gh", BOOTSTRAP_ADMIN_PASSWORD: "pw" }),
    ).toEqual({ email: "a@b.gov.gh", password: "pw" });
  });
});

describe("bootstrapAdmin", () => {
  it("ensures the admin role exists, then upserts the user by email", async () => {
    await bootstrapAdmin(mockPrisma, { email: "a@b.gov.gh", password: "secret-pw" });

    expect(roleUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: "admin" } }),
    );
    expect(userUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "a@b.gov.gh" } }),
    );
  });

  it("stores a bcrypt hash, never the plaintext password", async () => {
    await bootstrapAdmin(mockPrisma, { email: "a@b.gov.gh", password: "secret-pw" });

    const arg = userUpsert.mock.calls[0]![0];
    const hash = arg.create.passwordHash;
    expect(hash).not.toBe("secret-pw");
    expect(bcrypt.compareSync("secret-pw", hash)).toBe(true);
  });

  it("rotates the password on re-run (update also sets the hash)", async () => {
    await bootstrapAdmin(mockPrisma, { email: "a@b.gov.gh", password: "new-pw" });

    const arg = userUpsert.mock.calls[0]![0];
    expect(bcrypt.compareSync("new-pw", arg.update.passwordHash)).toBe(true);
  });

  it("creates the notification preference for the admin", async () => {
    await bootstrapAdmin(mockPrisma, { email: "a@b.gov.gh", password: "secret-pw" });

    expect(notifUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "admin-uuid" } }),
    );
  });
});
