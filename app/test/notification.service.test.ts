/**
 * Notification service tests — focus on the guarantees the rest of the
 * codebase relies on:
 *   1. sendNotification never throws (callers don't wrap it in try/catch).
 *   2. The dedupe window suppresses repeats of the same (user, type, key).
 *   3. Channel + per-type preferences are honoured.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  notification: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  notificationDeliveryLog: {
    create: vi.fn(),
    update: vi.fn(),
  },
}));

const emailMock = vi.hoisted(() => ({ sendEmail: vi.fn() }));
const smsMock = vi.hoisted(() => ({ sendSms: vi.fn() }));

vi.mock("~/server/utils/prisma", () => ({ default: prismaMock }));
vi.mock("~/server/services/email.service", () => ({ sendEmail: emailMock.sendEmail }));
vi.mock("~/server/services/sms.service", () => ({ sendSms: smsMock.sendSms }));

// Imported after mocks so the service binds to the mocked dependencies.
const { sendNotification } = await import("~/server/services/notification.service");

function makeUser(overrides: {
  email?: string;
  phone?: string | null;
  inAppEnabled?: boolean;
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  typePref?: { emailEnabled: boolean; smsEnabled: boolean; inAppEnabled: boolean } | null;
} = {}) {
  return {
    id: "user-1",
    email: overrides.email ?? "user@example.com",
    phone: "phone" in overrides ? overrides.phone : "233241234567",
    notificationPrefs: {
      emailEnabled: overrides.emailEnabled ?? true,
      smsEnabled: overrides.smsEnabled ?? true,
      inAppEnabled: overrides.inAppEnabled ?? true,
    },
    notificationTypePrefs: overrides.typePref ? [overrides.typePref] : [],
    applicantProfile: { fullName: "Test User" },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.notification.findFirst.mockResolvedValue(null);
  prismaMock.notification.create.mockResolvedValue({ id: "notif-1" });
  prismaMock.notificationDeliveryLog.create.mockResolvedValue({ id: "log-1" });
  prismaMock.notificationDeliveryLog.update.mockResolvedValue({});
  prismaMock.user.findUnique.mockResolvedValue(makeUser());
  emailMock.sendEmail.mockResolvedValue(true);
  smsMock.sendSms.mockResolvedValue({ success: true, messageId: "msg-1" });
});

describe("sendNotification — never throws", () => {
  it("swallows prisma errors instead of propagating to the caller", async () => {
    prismaMock.user.findUnique.mockRejectedValue(new Error("db down"));

    await expect(
      sendNotification({
        userId: "user-1",
        type: "UNIQUE_CODE_GENERATED",
        title: "t",
        message: "m",
      }),
    ).resolves.toBeUndefined();
  });

  it("swallows email send errors", async () => {
    emailMock.sendEmail.mockRejectedValue(new Error("smtp down"));

    await expect(
      sendNotification({
        userId: "user-1",
        type: "UNIQUE_CODE_GENERATED",
        title: "t",
        message: "m",
        channels: ["EMAIL"],
      }),
    ).resolves.toBeUndefined();

    // Delivery log should have been flipped to FAILED.
    const updates = prismaMock.notificationDeliveryLog.update.mock.calls;
    expect(updates.some((c) => c[0].data.status === "FAILED")).toBe(true);
  });

  it("swallows sms send errors", async () => {
    smsMock.sendSms.mockRejectedValue(new Error("hubtel down"));

    await expect(
      sendNotification({
        userId: "user-1",
        type: "UNIQUE_CODE_GENERATED",
        title: "t",
        message: "m",
        channels: ["SMS"],
      }),
    ).resolves.toBeUndefined();
  });

  it("returns silently when user is missing", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(
      sendNotification({
        userId: "ghost",
        type: "UNIQUE_CODE_GENERATED",
        title: "t",
        message: "m",
      }),
    ).resolves.toBeUndefined();

    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });
});

describe("sendNotification — dedupe", () => {
  it("skips when a recent notification with the same dedupe key exists", async () => {
    prismaMock.notification.findFirst.mockResolvedValue({ id: "existing" });

    await sendNotification({
      userId: "user-1",
      type: "RECEIPT_READY",
      title: "t",
      message: "m",
      dedupeKey: "RCPT-123",
    });

    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });

  it("proceeds when no recent dedupe match exists", async () => {
    prismaMock.notification.findFirst.mockResolvedValue(null);

    await sendNotification({
      userId: "user-1",
      type: "RECEIPT_READY",
      title: "t",
      message: "m",
      dedupeKey: "RCPT-123",
      channels: ["IN_APP"],
    });

    expect(prismaMock.notification.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.notification.create.mock.calls[0]![0].data.dedupeKey).toBe("RCPT-123");
  });

  it("skips the dedupe lookup entirely when no key is supplied", async () => {
    await sendNotification({
      userId: "user-1",
      type: "VERIFICATION_SUBMITTED",
      title: "t",
      message: "m",
      channels: ["IN_APP"],
    });

    expect(prismaMock.notification.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.notification.create).toHaveBeenCalledTimes(1);
  });
});

describe("sendNotification — preferences", () => {
  it("does not send email when emailEnabled=false", async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ emailEnabled: false }));

    await sendNotification({
      userId: "user-1",
      type: "REVIEW_APPROVED",
      title: "t",
      message: "m",
      channels: ["EMAIL", "IN_APP"],
    });

    expect(emailMock.sendEmail).not.toHaveBeenCalled();
    // The in-app row should still be created.
    expect(prismaMock.notification.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.notification.create.mock.calls[0]![0].data.channel).toBe("IN_APP");
  });

  it("respects per-type opt-out even when global pref is on", async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      makeUser({
        emailEnabled: true,
        smsEnabled: true,
        inAppEnabled: true,
        typePref: { emailEnabled: false, smsEnabled: false, inAppEnabled: true },
      }),
    );

    await sendNotification({
      userId: "user-1",
      type: "REVIEW_APPROVED",
      title: "t",
      message: "m",
    });

    expect(emailMock.sendEmail).not.toHaveBeenCalled();
    expect(smsMock.sendSms).not.toHaveBeenCalled();
    const channels = prismaMock.notification.create.mock.calls.map((c) => c[0].data.channel);
    expect(channels).toEqual(["IN_APP"]);
  });

  it("does not attempt SMS when the user has no phone", async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ phone: null }));

    await sendNotification({
      userId: "user-1",
      type: "UNIQUE_CODE_GENERATED",
      title: "t",
      message: "m",
      channels: ["SMS"],
    });

    expect(smsMock.sendSms).not.toHaveBeenCalled();
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });

  it("delivery log advances to DELIVERED on successful email", async () => {
    emailMock.sendEmail.mockResolvedValue(true);

    await sendNotification({
      userId: "user-1",
      type: "UNIQUE_CODE_GENERATED",
      title: "t",
      message: "m",
      channels: ["EMAIL"],
    });

    const update = prismaMock.notificationDeliveryLog.update.mock.calls[0]![0];
    expect(update.data.status).toBe("DELIVERED");
    expect(update.data.deliveredAt).toBeInstanceOf(Date);
  });

  it("delivery log advances to FAILED when email returns false", async () => {
    emailMock.sendEmail.mockResolvedValue(false);

    await sendNotification({
      userId: "user-1",
      type: "UNIQUE_CODE_GENERATED",
      title: "t",
      message: "m",
      channels: ["EMAIL"],
    });

    const update = prismaMock.notificationDeliveryLog.update.mock.calls[0]![0];
    expect(update.data.status).toBe("FAILED");
    expect(update.data.deliveredAt).toBeNull();
  });
});
