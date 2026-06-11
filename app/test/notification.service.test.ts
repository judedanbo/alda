/**
 * Notification service tests — focus on the guarantees the rest of the
 * codebase relies on:
 *   1. sendNotification never throws (callers don't wrap it in try/catch).
 *   2. The dedupe window suppresses repeats of the same (user, type, key).
 *   3. Channel + per-type preferences are honoured.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    findUnique: vi.fn(),
  },
  // Consulted by the system-settings registry (notification rate limit).
  // No overrides → the resolver falls back to the env value the tests set.
  systemSetting: {
    findMany: vi.fn().mockResolvedValue([]),
  },
}));

const emailMock = vi.hoisted(() => ({ sendEmail: vi.fn() }));
const smsMock = vi.hoisted(() => ({ sendSms: vi.fn() }));

vi.mock("~/server/utils/prisma", () => ({ default: prismaMock }));
vi.mock("~/server/services/email.service", () => ({ sendEmail: emailMock.sendEmail }));
vi.mock("~/server/services/sms.service", () => ({ sendSms: smsMock.sendSms }));

// Imported after mocks so the service binds to the mocked dependencies.
const { sendNotification, recordPhoneVerificationSms, retryDelivery } = await import(
  "~/server/services/notification.service"
);

function makeUser(overrides: {
  email?: string;
  phone?: string | null;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  inAppEnabled?: boolean;
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  typePref?: { emailEnabled: boolean; smsEnabled: boolean; inAppEnabled: boolean } | null;
} = {}) {
  return {
    id: "user-1",
    email: overrides.email ?? "user@example.com",
    phone: "phone" in overrides ? overrides.phone : "233241234567",
    emailVerified: overrides.emailVerified ?? true,
    phoneVerified: overrides.phoneVerified ?? true,
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

describe("sendNotification — per-user-per-type rate limit", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env.NOTIFICATIONS_RATE_LIMIT_PER_HOUR = "1";
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

  it("skips the second send for the same (user, type) within the window", async () => {
    // First call should go through.
    await sendNotification({
      userId: "rate-user-A",
      type: "REVIEW_APPROVED",
      title: "first",
      message: "first",
      channels: ["IN_APP"],
    });
    const firstCreateCount = prismaMock.notification.create.mock.calls.length;
    expect(firstCreateCount).toBeGreaterThan(0);

    // Second call same user+type should be dropped before user fetch.
    prismaMock.user.findUnique.mockClear();
    prismaMock.notification.create.mockClear();
    await sendNotification({
      userId: "rate-user-A",
      type: "REVIEW_APPROVED",
      title: "second",
      message: "second",
      channels: ["IN_APP"],
    });
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.notification.create).not.toHaveBeenCalled();
  });

  it("does not rate-limit security/transactional types", async () => {
    await sendNotification({
      userId: "rate-user-B",
      type: "PASSWORD_RESET",
      title: "first",
      message: "first",
      channels: ["IN_APP"],
    });
    prismaMock.user.findUnique.mockClear();
    prismaMock.notification.create.mockClear();
    await sendNotification({
      userId: "rate-user-B",
      type: "PASSWORD_RESET",
      title: "second",
      message: "second",
      channels: ["IN_APP"],
    });
    expect(prismaMock.user.findUnique).toHaveBeenCalled();
    expect(prismaMock.notification.create).toHaveBeenCalled();
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

describe("recordPhoneVerificationSms — admin-log visibility for the direct OTP send", () => {
  it("records a PHONE_VERIFICATION_CODE SMS notification + DELIVERED log on success", async () => {
    await recordPhoneVerificationSms("user-1", {
      success: true,
      messageId: "msg-9",
      provider: "arkesel",
    });

    const notif = prismaMock.notification.create.mock.calls[0]![0];
    expect(notif.data.type).toBe("PHONE_VERIFICATION_CODE");
    expect(notif.data.channel).toBe("SMS");

    const log = prismaMock.notificationDeliveryLog.create.mock.calls[0]![0];
    expect(log.data.channel).toBe("SMS");
    expect(log.data.status).toBe("DELIVERED");
    expect(log.data.deliveredAt).toBeInstanceOf(Date);
    expect(log.data.providerResponse).toMatchObject({ messageId: "msg-9", provider: "arkesel" });
  });

  it("never persists the actual OTP (the recorder is not even given the code)", async () => {
    await recordPhoneVerificationSms("user-1", { success: true, messageId: "m", provider: "hubtel" });

    const notif = prismaMock.notification.create.mock.calls[0]![0];
    // No 4+ digit run anywhere in the stored title/message.
    expect(`${notif.data.title} ${notif.data.message}`).not.toMatch(/\d{4,}/);
  });

  it("records a FAILED log with the provider error when the send failed", async () => {
    await recordPhoneVerificationSms("user-1", { success: false, error: "provider down" });

    const log = prismaMock.notificationDeliveryLog.create.mock.calls[0]![0];
    expect(log.data.status).toBe("FAILED");
    expect(log.data.deliveredAt).toBeNull();
    expect(log.data.providerResponse).toMatchObject({ error: "provider down" });
  });

  it("never throws — admin-log bookkeeping must not break the verify response", async () => {
    prismaMock.notification.create.mockRejectedValueOnce(new Error("db down"));

    await expect(
      recordPhoneVerificationSms("user-1", { success: true, messageId: "m", provider: "arkesel" }),
    ).resolves.toBeUndefined();
  });
});

describe("retryDelivery — phone verification codes are not retriable", () => {
  it("rejects a retry of a PHONE_VERIFICATION_CODE delivery log", async () => {
    prismaMock.notificationDeliveryLog.findUnique.mockResolvedValue({
      id: "log-1",
      status: "FAILED",
      channel: "SMS",
      retryCount: 0,
      notification: {
        type: "PHONE_VERIFICATION_CODE",
        title: "Phone verification code",
        message: "A phone verification code was sent by SMS.",
        metadata: null,
        user: { phone: "233241234567", phoneVerified: true, applicantProfile: { fullName: "Test User" } },
      },
    });

    await expect(retryDelivery("log-1")).rejects.toMatchObject({ statusCode: 400 });
    // Must not have attempted to resend (no status reset to PENDING).
    expect(prismaMock.notificationDeliveryLog.update).not.toHaveBeenCalled();
  });

  it("rejects an email retry when the recipient's email is not verified", async () => {
    prismaMock.notificationDeliveryLog.findUnique.mockResolvedValue({
      id: "log-1",
      status: "FAILED",
      channel: "EMAIL",
      retryCount: 0,
      notification: {
        type: "REVIEW_APPROVED",
        title: "t",
        message: "m",
        metadata: null,
        user: { email: "user@example.com", emailVerified: false, applicantProfile: { fullName: "Test User" } },
      },
    });

    await expect(retryDelivery("log-1")).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects an SMS retry when the recipient's phone is not verified", async () => {
    prismaMock.notificationDeliveryLog.findUnique.mockResolvedValue({
      id: "log-1",
      status: "FAILED",
      channel: "SMS",
      retryCount: 0,
      notification: {
        type: "REVIEW_APPROVED",
        title: "t",
        message: "m",
        metadata: null,
        user: { phone: "233241234567", phoneVerified: false, applicantProfile: { fullName: "Test User" } },
      },
    });

    await expect(retryDelivery("log-1")).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("sendNotification — verified contacts only", () => {
  it("does not send email to an unverified address", async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ emailVerified: false }));

    await sendNotification({
      userId: "user-1",
      type: "REVIEW_APPROVED",
      title: "t",
      message: "m",
      channels: ["EMAIL", "IN_APP"],
    });

    expect(emailMock.sendEmail).not.toHaveBeenCalled();
    // The in-app row is still created — verification only gates email/SMS.
    const channels = prismaMock.notification.create.mock.calls.map((c) => c[0].data.channel);
    expect(channels).toEqual(["IN_APP"]);
  });

  it("does not send SMS to an unverified phone", async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ phoneVerified: false }));

    await sendNotification({
      userId: "user-1",
      type: "UNIQUE_CODE_GENERATED",
      title: "t",
      message: "m",
      channels: ["SMS", "IN_APP"],
    });

    expect(smsMock.sendSms).not.toHaveBeenCalled();
    const channels = prismaMock.notification.create.mock.calls.map((c) => c[0].data.channel);
    expect(channels).toEqual(["IN_APP"]);
  });

  it("still emails security/transactional types to an unverified address", async () => {
    prismaMock.user.findUnique.mockResolvedValue(makeUser({ emailVerified: false }));

    await sendNotification({
      userId: "user-1",
      type: "EMAIL_VERIFICATION",
      title: "Verify your email",
      message: "m",
      channels: ["EMAIL"],
    });

    expect(emailMock.sendEmail).toHaveBeenCalledTimes(1);
  });
});
