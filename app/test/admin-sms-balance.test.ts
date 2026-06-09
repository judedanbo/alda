/**
 * Tests for GET /api/admin/notifications/sms-balance — the Arkesel SMS-credit
 * probe. Mocks prisma (admin role check), getCredential (effective-key
 * resolution), and global fetch (Arkesel response).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  userRole: { findMany: vi.fn() },
}));
const getCredentialMock = vi.hoisted(() => vi.fn());

vi.mock("~/server/utils/prisma", () => ({ default: prismaMock }));
vi.mock("~/server/utils/notification-config", () => ({ getCredential: getCredentialMock }));

const handler = (await import("~/server/api/admin/notifications/sms-balance.get")).default;

function adminEvent() {
  return {
    context: { auth: { userId: "admin-1", email: "admin@example.com", roles: ["admin"] } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.userRole.findMany.mockResolvedValue([{ role: { name: "admin" } }]);
});

afterEach(() => {
  // NB: don't call vi.unstubAllGlobals() — it would also remove the
  // createError/defineEventHandler globals installed by test/setup.ts. Each
  // test that needs `fetch` re-stubs it, so clearing mocks is enough.
  vi.clearAllMocks();
});

describe("GET /api/admin/notifications/sms-balance", () => {
  it("rejects unauthenticated callers with 401", async () => {
    const event = adminEvent();
    event.context.auth = undefined;
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("rejects non-admins with 403", async () => {
    prismaMock.userRole.findMany.mockResolvedValue([{ role: { name: "schedule_officer" } }]);
    getCredentialMock.mockResolvedValue("key");
    await expect(handler(adminEvent())).rejects.toMatchObject({ statusCode: 403 });
  });

  it("reports configured:false when no Arkesel key is set", async () => {
    getCredentialMock.mockResolvedValue("");
    const res = await handler(adminEvent());
    expect(res).toEqual({ ok: false, configured: false });
  });

  it("returns the balance with low:false when above the threshold", async () => {
    getCredentialMock.mockResolvedValue("key");
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ balance: 717, user: "Richard Mensah", country: "Ghana" }),
    })));
    const res = await handler(adminEvent());
    expect(res).toMatchObject({
      ok: true, configured: true, balance: 717, user: "Richard Mensah",
      country: "Ghana", low: false, threshold: 50,
    });
  });

  it("flags low:true when the balance is below the threshold", async () => {
    getCredentialMock.mockResolvedValue("key");
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ balance: 30, user: "Richard Mensah", country: "Ghana" }),
    })));
    const res = await handler(adminEvent());
    expect(res).toMatchObject({ ok: true, low: true, balance: 30, threshold: 50 });
  });

  it("returns ok:false with a hint when Arkesel rejects the key", async () => {
    getCredentialMock.mockResolvedValue("bad-key");
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      json: async () => ({ message: "Invalid API Key" }),
    })));
    const res = await handler(adminEvent());
    expect(res).toMatchObject({ ok: false, configured: true, hint: "Invalid API Key" });
  });
});
