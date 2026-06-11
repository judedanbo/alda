/**
 * Tests for in-app notification credentials:
 *  - resolver precedence (DB override → env fallback) + secret-omission in status
 *  - PUT /api/admin/notifications/credentials (encrypt on set, delete on clear,
 *    key/value validation, audit)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { H3Event } from "h3";

const prismaMock = vi.hoisted(() => ({
  notificationCredential: {
    findMany: vi.fn(() => [] as Array<{ key: string; valueCipher: string }>),
    upsert: vi.fn(),
    deleteMany: vi.fn(),
  },
  userRole: { findMany: vi.fn() },
}));
const encMock = vi.hoisted(() => ({
  encryptPii: vi.fn((s: string) => `enc:${s}`),
  decryptPii: vi.fn((s: string) => s.replace(/^enc:/, "")),
}));
const logAuditMock = vi.hoisted(() => vi.fn());
const readBodyMock = vi.hoisted(() => vi.fn());

vi.mock("~/server/utils/prisma", () => ({ default: prismaMock }));
vi.mock("~/server/utils/pii-encryption", () => encMock);
vi.mock("~/server/utils/audit", async () => {
  const actual = await vi.importActual<typeof import("~/server/utils/audit")>("~/server/utils/audit");
  return { ...actual, logAudit: logAuditMock };
});
vi.stubGlobal("readBody", readBodyMock);

const cfg = await import("~/server/utils/notification-config");
const putHandler = (await import("~/server/api/admin/notifications/credentials/index.put")).default;

beforeEach(() => {
  vi.clearAllMocks();
  cfg.invalidateCredentialCache();
  vi.stubGlobal("useRuntimeConfig", () => ({
    smtpHost: "envhost", smtpPort: 587, smtpUser: "envuser", smtpPass: "envpass", smtpFrom: "env@from",
  }));
});
afterEach(() => vi.clearAllMocks());

describe("credential resolver", () => {
  it("returns the decrypted DB value when an override exists", async () => {
    prismaMock.notificationCredential.findMany.mockReturnValueOnce([{ key: "smtp.user", valueCipher: "enc:dbuser" }]);
    cfg.invalidateCredentialCache();
    expect(await cfg.getCredential("smtp.user")).toBe("dbuser");
  });

  it("falls back to env when no override row exists", async () => {
    expect(await cfg.getCredential("smtp.user")).toBe("envuser");
  });

  it("falls back to env when the DB override decrypts to empty", async () => {
    prismaMock.notificationCredential.findMany.mockReturnValueOnce([{ key: "smtp.user", valueCipher: "enc:" }]);
    cfg.invalidateCredentialCache();
    expect(await cfg.getCredential("smtp.user")).toBe("envuser");
  });

  it("resolves email config per-field (DB host over env, env user)", async () => {
    prismaMock.notificationCredential.findMany.mockReturnValueOnce([{ key: "smtp.host", valueCipher: "enc:dbhost" }]);
    cfg.invalidateCredentialCache();
    const c = await cfg.getResolvedEmailConfig();
    expect(c.host).toBe("dbhost");
    expect(c.user).toBe("envuser");
    expect(c.port).toBe(587);
  });

  it("status omits secret values but includes non-secret values and correct source", async () => {
    prismaMock.notificationCredential.findMany.mockReturnValueOnce([{ key: "smtp.pass", valueCipher: "enc:dbpass" }]);
    cfg.invalidateCredentialCache();
    const fields = await cfg.getCredentialStatus();

    const pass = fields.find((f) => f.key === "smtp.pass")!;
    expect(pass.secret).toBe(true);
    expect(pass.source).toBe("db");
    expect(pass).not.toHaveProperty("value"); // secret value never exposed

    const host = fields.find((f) => f.key === "smtp.host")!;
    expect(host.source).toBe("env");
    expect(host.value).toBe("envhost"); // non-secret effective value shown
  });
});

describe("PUT /api/admin/notifications/credentials", () => {
  const fakeEvent = (role = "admin") =>
    ({ context: { auth: { userId: "admin-1", email: "a@b.c", roles: [role] } } }) as unknown as H3Event;

  beforeEach(() => {
    prismaMock.userRole.findMany.mockResolvedValue([{ role: { name: "admin" } }]);
    prismaMock.notificationCredential.upsert.mockResolvedValue({});
    prismaMock.notificationCredential.deleteMany.mockResolvedValue({ count: 1 });
  });

  it("encrypts and upserts on set, audits UPDATED", async () => {
    readBodyMock.mockResolvedValue({ set: { "smtp.user": "newuser" } });
    await putHandler(fakeEvent());

    expect(encMock.encryptPii).toHaveBeenCalledWith("newuser");
    expect(prismaMock.notificationCredential.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: "smtp.user" } }),
    );
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "notification_credential_updated", entityType: "notification_credential" }),
    );
  });

  it("deletes on clear, audits CLEARED", async () => {
    readBodyMock.mockResolvedValue({ clear: ["smtp.user"] });
    await putHandler(fakeEvent());

    expect(prismaMock.notificationCredential.deleteMany).toHaveBeenCalledWith({ where: { key: { in: ["smtp.user"] } } });
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "notification_credential_cleared" }),
    );
  });

  it("rejects an unknown credential key with 400", async () => {
    readBodyMock.mockResolvedValue({ set: { "bogus.key": "x" } });
    await expect(putHandler(fakeEvent())).rejects.toMatchObject({ statusCode: 400 });
    expect(prismaMock.notificationCredential.upsert).not.toHaveBeenCalled();
  });

  it("rejects a non-numeric SMTP port with 400", async () => {
    readBodyMock.mockResolvedValue({ set: { "smtp.port": "not-a-number" } });
    await expect(putHandler(fakeEvent())).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects an invalid provider value with 400", async () => {
    readBodyMock.mockResolvedValue({ set: { "sms.provider": "carrier-pigeon" } });
    await expect(putHandler(fakeEvent())).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects non-admins with 403", async () => {
    prismaMock.userRole.findMany.mockResolvedValue([{ role: { name: "applicant" } }]);
    readBodyMock.mockResolvedValue({ set: {} });
    await expect(putHandler(fakeEvent("applicant"))).rejects.toMatchObject({ statusCode: 403 });
  });
});
