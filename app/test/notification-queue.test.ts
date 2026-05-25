/**
 * Tests for the BullMQ job processors. We don't spin up a real Redis;
 * we just invoke the processor functions directly with a fake Job and
 * verify they update the delivery log correctly and propagate failures
 * to BullMQ (by throwing).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  notificationDeliveryLog: {
    update: vi.fn(),
  },
}));
const emailMock = vi.hoisted(() => ({ sendEmail: vi.fn() }));
const smsMock = vi.hoisted(() => ({ sendSms: vi.fn() }));

vi.mock("~/server/utils/prisma", () => ({ default: prismaMock }));
vi.mock("~/server/services/email.service", () => ({ sendEmail: emailMock.sendEmail }));
vi.mock("~/server/services/sms.service", () => ({ sendSms: smsMock.sendSms }));

const { processEmailJob, processSmsJob } = await import("~/server/utils/notification-queue");

interface FakeJob<T> {
  data: T;
  attemptsMade: number;
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.notificationDeliveryLog.update.mockResolvedValue({});
});

describe("processEmailJob", () => {
  const baseData = {
    deliveryLogId: "log-1",
    to: "user@example.com",
    subject: "Hi",
    template: "welcome" as const,
    data: { name: "Test" },
  };

  it("marks delivered and records retryCount on success", async () => {
    emailMock.sendEmail.mockResolvedValue(true);
    const job: FakeJob<typeof baseData> = { data: baseData, attemptsMade: 2 };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await processEmailJob(job as any);

    const update = prismaMock.notificationDeliveryLog.update.mock.calls[0]![0];
    expect(update.where).toEqual({ id: "log-1" });
    expect(update.data.status).toBe("DELIVERED");
    expect(update.data.deliveredAt).toBeInstanceOf(Date);
    expect(update.data.retryCount).toBe(2);
  });

  it("throws when sendEmail returns false so BullMQ retries", async () => {
    emailMock.sendEmail.mockResolvedValue(false);
    const job: FakeJob<typeof baseData> = { data: baseData, attemptsMade: 1 };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(processEmailJob(job as any)).rejects.toThrow();

    const update = prismaMock.notificationDeliveryLog.update.mock.calls[0]![0];
    expect(update.data.status).toBe("FAILED");
    expect(update.data.retryCount).toBe(1);
  });

  it("throws and records the error message when sendEmail throws", async () => {
    emailMock.sendEmail.mockRejectedValue(new Error("smtp: ECONNRESET"));
    const job: FakeJob<typeof baseData> = { data: baseData, attemptsMade: 3 };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(processEmailJob(job as any)).rejects.toThrow("smtp: ECONNRESET");

    const update = prismaMock.notificationDeliveryLog.update.mock.calls[0]![0];
    expect(update.data.status).toBe("FAILED");
    expect(update.data.providerResponse).toEqual({ error: "smtp: ECONNRESET" });
    expect(update.data.retryCount).toBe(3);
  });
});

describe("processSmsJob", () => {
  const baseData = {
    deliveryLogId: "log-2",
    to: "233241234567",
    message: "Hello",
  };

  it("marks delivered and stores messageId on success", async () => {
    smsMock.sendSms.mockResolvedValue({ success: true, messageId: "msg-1" });
    const job: FakeJob<typeof baseData> = { data: baseData, attemptsMade: 1 };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await processSmsJob(job as any);

    const update = prismaMock.notificationDeliveryLog.update.mock.calls[0]![0];
    expect(update.data.status).toBe("DELIVERED");
    expect(update.data.providerResponse).toEqual({ messageId: "msg-1" });
    expect(update.data.retryCount).toBe(1);
  });

  it("throws and stores error when provider reports failure", async () => {
    smsMock.sendSms.mockResolvedValue({ success: false, error: "throttled" });
    const job: FakeJob<typeof baseData> = { data: baseData, attemptsMade: 2 };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(processSmsJob(job as any)).rejects.toThrow("throttled");

    const update = prismaMock.notificationDeliveryLog.update.mock.calls[0]![0];
    expect(update.data.status).toBe("FAILED");
    expect(update.data.providerResponse).toEqual({ error: "throttled" });
  });

  it("handles synchronous provider exceptions", async () => {
    smsMock.sendSms.mockRejectedValue(new Error("network unreachable"));
    const job: FakeJob<typeof baseData> = { data: baseData, attemptsMade: 1 };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(processSmsJob(job as any)).rejects.toThrow("network unreachable");

    const update = prismaMock.notificationDeliveryLog.update.mock.calls[0]![0];
    expect(update.data.status).toBe("FAILED");
    expect(update.data.providerResponse).toEqual({ error: "network unreachable" });
  });
});
