/**
 * Tests for the shared SMS-webhook utilities — secret verification and
 * provider-status mapping. The route handlers compose these primitives
 * with prisma writes, so testing the primitives in isolation is enough
 * to lock in the contract.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  notificationDeliveryLog: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
}));
vi.mock("~/server/utils/prisma", () => ({ default: prismaMock }));

const { verifyWebhookSecret, applyDeliveryUpdate, findLogByMessageId } = await import(
  "~/server/utils/sms-webhook"
);

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
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

function fakeEvent(headers: Record<string, string> = {}, query: Record<string, string> = {}) {
  const qs = Object.keys(query).length ? "?" + new URLSearchParams(query).toString() : "";
  return {
    // h3's getQuery reads from event.path, getHeader reads from node.req.headers.
    path: "/api/webhooks/sms/hubtel" + qs,
    node: {
      req: {
        headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])),
        url: "/api/webhooks/sms/hubtel" + qs,
      },
    },
    context: { params: {} },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("verifyWebhookSecret", () => {
  it("accepts any request when no secret is configured (dev mode)", () => {
    delete process.env.NOTIFICATIONS_SMS_WEBHOOK_SECRET;
    expect(verifyWebhookSecret(fakeEvent())).toBe(true);
  });

  it("rejects when secret configured but header missing", () => {
    process.env.NOTIFICATIONS_SMS_WEBHOOK_SECRET = "topsecret";
    expect(verifyWebhookSecret(fakeEvent())).toBe(false);
  });

  it("accepts when x-webhook-secret matches", () => {
    process.env.NOTIFICATIONS_SMS_WEBHOOK_SECRET = "topsecret";
    expect(verifyWebhookSecret(fakeEvent({ "x-webhook-secret": "topsecret" }))).toBe(true);
  });

  it("accepts when ?secret= query string matches", () => {
    process.env.NOTIFICATIONS_SMS_WEBHOOK_SECRET = "topsecret";
    expect(verifyWebhookSecret(fakeEvent({}, { secret: "topsecret" }))).toBe(true);
  });

  it("rejects on mismatched secret", () => {
    process.env.NOTIFICATIONS_SMS_WEBHOOK_SECRET = "topsecret";
    expect(verifyWebhookSecret(fakeEvent({ "x-webhook-secret": "wrong" }))).toBe(false);
  });
});

describe("findLogByMessageId", () => {
  it("queries SMS logs by messageId in providerResponse", async () => {
    prismaMock.notificationDeliveryLog.findFirst.mockResolvedValue({ id: "log-1" });

    const result = await findLogByMessageId("msg-1");

    expect(result).toEqual({ id: "log-1" });
    const args = prismaMock.notificationDeliveryLog.findFirst.mock.calls[0]![0];
    expect(args.where.channel).toBe("SMS");
    expect(args.where.providerResponse).toEqual({ path: ["messageId"], equals: "msg-1" });
  });
});

describe("applyDeliveryUpdate", () => {
  it("sets deliveredAt on DELIVERED status", async () => {
    prismaMock.notificationDeliveryLog.update.mockResolvedValue({});
    await applyDeliveryUpdate("log-1", "DELIVERED", { webhook: "payload" });
    const args = prismaMock.notificationDeliveryLog.update.mock.calls[0]![0];
    expect(args.where).toEqual({ id: "log-1" });
    expect(args.data.status).toBe("DELIVERED");
    expect(args.data.deliveredAt).toBeInstanceOf(Date);
    expect(args.data.providerResponse).toEqual({ webhook: { webhook: "payload" } });
  });

  it("leaves deliveredAt null on FAILED status", async () => {
    prismaMock.notificationDeliveryLog.update.mockResolvedValue({});
    await applyDeliveryUpdate("log-1", "FAILED", { reason: "expired" });
    const args = prismaMock.notificationDeliveryLog.update.mock.calls[0]![0];
    expect(args.data.status).toBe("FAILED");
    expect(args.data.deliveredAt).toBeNull();
  });
});
