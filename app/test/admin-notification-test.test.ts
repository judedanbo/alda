/**
 * Tests for the admin "send test notification" endpoint.
 *
 * We don't exercise prisma deeply — just confirm the schema validates,
 * the lookup runs, sendNotification is called with the expected
 * sample payload, and the audit log is written.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
}));
const sendNotificationMock = vi.hoisted(() => vi.fn());
const logActionMock = vi.hoisted(() => vi.fn());
const readBodyMock = vi.hoisted(() => vi.fn());

vi.mock("~/server/utils/prisma", () => ({ default: prismaMock }));
vi.mock("~/server/services/notification.service", () => ({
  sendNotification: sendNotificationMock,
}));
vi.mock("~/server/utils/audit", async () => {
  const actual = await vi.importActual<typeof import("~/server/utils/audit")>(
    "~/server/utils/audit",
  );
  return { ...actual, logAction: logActionMock };
});
vi.stubGlobal("readBody", readBodyMock);

const handler = (await import("~/server/api/admin/notifications/test.post")).default;

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.user.findUnique.mockResolvedValue({
    id: "target-1",
    email: "target@example.com",
    applicantProfile: { fullName: "Target User" },
  });
  sendNotificationMock.mockResolvedValue(undefined);
  logActionMock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

function fakeEvent(authUserId: string = "admin-1") {
  return {
    path: "/api/admin/notifications/test",
    node: { req: { headers: {}, url: "/api/admin/notifications/test" } },
    context: { auth: { userId: authUserId, email: "admin@example.com", roles: ["admin"] } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("POST /api/admin/notifications/test", () => {
  it("rejects unauthenticated callers", async () => {
    readBodyMock.mockResolvedValue({ type: "REVIEW_APPROVED" });
    const event = fakeEvent();
    event.context.auth = undefined;

    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("rejects unknown notification types via schema", async () => {
    readBodyMock.mockResolvedValue({ type: "NOT_A_REAL_TYPE" });

    await expect(handler(fakeEvent())).rejects.toBeTruthy();
    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it("defaults targetUserId to the caller when omitted", async () => {
    readBodyMock.mockResolvedValue({ type: "REVIEW_APPROVED" });

    await handler(fakeEvent("admin-1"));

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "admin-1" } }),
    );
    expect(sendNotificationMock).toHaveBeenCalledTimes(1);
    const call = sendNotificationMock.mock.calls[0]![0];
    expect(call.userId).toBe("admin-1");
    expect(call.type).toBe("REVIEW_APPROVED");
    expect(call.title).toMatch(/^\[TEST\]/);
    expect(call.metadata.preview).toBe(true);
    expect(call.metadata.triggeredBy).toBe("admin-1");
  });

  it("sends to a specified target user when provided", async () => {
    readBodyMock.mockResolvedValue({
      type: "RECEIPT_READY",
      targetUserId: "00000000-0000-0000-0000-000000000999",
    });

    await handler(fakeEvent("admin-1"));

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "00000000-0000-0000-0000-000000000999" } }),
    );
    const call = sendNotificationMock.mock.calls[0]![0];
    expect(call.userId).toBe("00000000-0000-0000-0000-000000000999");
  });

  it("404s when the target user does not exist", async () => {
    readBodyMock.mockResolvedValue({ type: "REVIEW_APPROVED" });
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(handler(fakeEvent())).rejects.toMatchObject({ statusCode: 404 });
    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it("respects requested channels", async () => {
    readBodyMock.mockResolvedValue({
      type: "REVIEW_APPROVED",
      channels: ["IN_APP"],
    });

    await handler(fakeEvent());

    expect(sendNotificationMock.mock.calls[0]![0].channels).toEqual(["IN_APP"]);
  });

  it("writes an audit log of the test send", async () => {
    readBodyMock.mockResolvedValue({ type: "REVIEW_APPROVED" });

    await handler(fakeEvent("admin-1"));

    expect(logActionMock).toHaveBeenCalledTimes(1);
    const logArgs = logActionMock.mock.calls[0]![0];
    expect(logArgs.action).toBe("notification_test_sent");
    expect(logArgs.userId).toBe("admin-1");
    expect(logArgs.newValues.type).toBe("REVIEW_APPROVED");
  });
});
