/**
 * End-to-end tests for the SMS webhook route handlers. Exercises the
 * full POST flow through prisma mocks: secret check → JSON parse →
 * status map → log lookup → log update.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  notificationDeliveryLog: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  // verifyWebhookSecret resolves the secret via the credential resolver, which
  // reads DB overrides first; empty → env fallback (set in these tests).
  notificationCredential: { findMany: vi.fn(() => []) },
}));
vi.mock("~/server/utils/prisma", () => ({ default: prismaMock }));

// `readBody` is auto-imported in route handlers. Stub it.
const readBodyMock = vi.hoisted(() => vi.fn());
vi.stubGlobal("readBody", readBodyMock);

const hubtelHandler = (await import("~/server/api/webhooks/sms/hubtel.post")).default;
const arkeselHandler = (await import("~/server/api/webhooks/sms/arkesel.post")).default;

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.notificationDeliveryLog.findFirst.mockResolvedValue({ id: "log-1" });
  prismaMock.notificationDeliveryLog.update.mockResolvedValue({});
});

afterEach(() => {
  for (const k of Object.keys(process.env)) {
    if (!(k in ORIGINAL_ENV)) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete process.env[k];
    }
  }
  Object.assign(process.env, ORIGINAL_ENV);
});

function fakeEvent(headers: Record<string, string> = {}) {
  return {
    path: "/api/webhooks/sms/hubtel",
    node: {
      req: {
        headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])),
        url: "/api/webhooks/sms/hubtel",
      },
    },
    context: { params: {} },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("POST /api/webhooks/sms/hubtel", () => {
  it("maps Hubtel 'Delivered' to DELIVERED and updates the log", async () => {
    readBodyMock.mockResolvedValue({ MessageId: "msg-1", Status: "Delivered" });

    const result = await hubtelHandler(fakeEvent());

    expect(result).toMatchObject({ ok: true, status: "DELIVERED" });
    const update = prismaMock.notificationDeliveryLog.update.mock.calls[0]![0];
    expect(update.data.status).toBe("DELIVERED");
    expect(update.data.deliveredAt).toBeInstanceOf(Date);
  });

  it("maps 'Failed' to FAILED", async () => {
    readBodyMock.mockResolvedValue({ MessageId: "msg-1", Status: "Failed" });

    const result = await hubtelHandler(fakeEvent());

    expect(result).toMatchObject({ status: "FAILED" });
    expect(prismaMock.notificationDeliveryLog.update.mock.calls[0]![0].data.status).toBe("FAILED");
  });

  it("ignores intermediate states without updating", async () => {
    readBodyMock.mockResolvedValue({ MessageId: "msg-1", Status: "Pending" });

    const result = await hubtelHandler(fakeEvent());

    expect(result).toMatchObject({ ok: true, ignored: true });
    expect(prismaMock.notificationDeliveryLog.update).not.toHaveBeenCalled();
  });

  it("rejects with 401 when secret mismatches", async () => {
    process.env.NOTIFICATIONS_SMS_WEBHOOK_SECRET = "topsecret";
    readBodyMock.mockResolvedValue({ MessageId: "msg-1", Status: "Delivered" });

    await expect(hubtelHandler(fakeEvent({ "x-webhook-secret": "wrong" }))).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it("returns found:false when the messageId is unknown", async () => {
    prismaMock.notificationDeliveryLog.findFirst.mockResolvedValue(null);
    readBodyMock.mockResolvedValue({ MessageId: "ghost", Status: "Delivered" });

    const result = await hubtelHandler(fakeEvent());

    expect(result).toMatchObject({ found: false });
    expect(prismaMock.notificationDeliveryLog.update).not.toHaveBeenCalled();
  });
});

describe("POST /api/webhooks/sms/arkesel", () => {
  it("maps 'DELIVERED' upper-case status to DELIVERED", async () => {
    readBodyMock.mockResolvedValue({ id: "msg-2", status: "DELIVERED" });

    const result = await arkeselHandler(fakeEvent());

    expect(result).toMatchObject({ status: "DELIVERED" });
    expect(prismaMock.notificationDeliveryLog.update.mock.calls[0]![0].data.status).toBe("DELIVERED");
  });

  it("maps 'EXPIRED' to FAILED", async () => {
    readBodyMock.mockResolvedValue({ id: "msg-2", status: "EXPIRED" });

    const result = await arkeselHandler(fakeEvent());

    expect(result).toMatchObject({ status: "FAILED" });
  });

  it("ignores when id is missing", async () => {
    readBodyMock.mockResolvedValue({ status: "DELIVERED" });

    const result = await arkeselHandler(fakeEvent());

    expect(result).toMatchObject({ ignored: true });
    expect(prismaMock.notificationDeliveryLog.update).not.toHaveBeenCalled();
  });
});
