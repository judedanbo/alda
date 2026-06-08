/**
 * Tests for the admin notification-monitoring backend:
 *  - retryDelivery() service helper (faithful payload rebuild, guards,
 *    queue vs inline dispatch)
 *  - GET /api/admin/notifications (auth guards + where-builder)
 *  - POST /api/admin/notifications/[id]/retry (audit log + delegation)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { H3Event } from "h3";

const prismaMock = vi.hoisted(() => ({
  notificationDeliveryLog: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  userRole: { findMany: vi.fn() },
}));
const queueMock = vi.hoisted(() => ({
  reenqueueEmailJob: vi.fn(),
  reenqueueSmsJob: vi.fn(),
  processEmailJob: vi.fn(),
  processSmsJob: vi.fn(),
  enqueueEmailJob: vi.fn(),
  enqueueSmsJob: vi.fn(),
  isQueueEnabled: vi.fn(() => true),
}));
const retryDeliveryMock = vi.hoisted(() => vi.fn());
const createAuditLogMock = vi.hoisted(() => vi.fn());

vi.mock("~/server/utils/prisma", () => ({ default: prismaMock }));
vi.mock("~/server/utils/notification-queue", () => queueMock);

const { retryDelivery } = await import("~/server/services/notification.service");

function failedEmailLog(overrides: Record<string, unknown> = {}) {
  return {
    id: "log-1",
    channel: "EMAIL",
    status: "FAILED",
    retryCount: 2,
    notification: {
      id: "n-1",
      type: "REVIEW_APPROVED",
      title: "Declaration Approved",
      message: "Your declaration was approved.",
      metadata: { uniqueCode: "ADLA-1" },
      user: {
        email: "jane@example.com",
        phone: "+233200000000",
        applicantProfile: { fullName: "Jane Doe" },
      },
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  queueMock.isQueueEnabled.mockReturnValue(true);
  prismaMock.notificationDeliveryLog.update.mockResolvedValue({});
});

afterEach(() => vi.clearAllMocks());

describe("retryDelivery", () => {
  it("rebuilds the EMAIL payload faithfully and re-enqueues when the queue is on", async () => {
    prismaMock.notificationDeliveryLog.findUnique.mockResolvedValue(failedEmailLog());

    const result = await retryDelivery("log-1");

    expect(queueMock.reenqueueEmailJob).toHaveBeenCalledTimes(1);
    expect(queueMock.reenqueueEmailJob).toHaveBeenCalledWith({
      deliveryLogId: "log-1",
      to: "jane@example.com",
      subject: "Declaration Approved",
      template: "declaration-approved", // mapped from REVIEW_APPROVED
      data: { name: "Jane Doe", uniqueCode: "ADLA-1" },
    });
    // Reset to in-flight before dispatch
    expect(prismaMock.notificationDeliveryLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "log-1" }, data: expect.objectContaining({ status: "PENDING" }) }),
    );
    expect(result).toMatchObject({ channel: "EMAIL", status: "PENDING", queued: true });
    expect(queueMock.processEmailJob).not.toHaveBeenCalled();
  });

  it("rebuilds the SMS payload faithfully and re-enqueues when the queue is on", async () => {
    prismaMock.notificationDeliveryLog.findUnique.mockResolvedValue(
      failedEmailLog({ id: "log-2", channel: "SMS" }),
    );

    const result = await retryDelivery("log-2");

    expect(queueMock.reenqueueSmsJob).toHaveBeenCalledWith({
      deliveryLogId: "log-2",
      to: "+233200000000",
      message: "Your declaration was approved.",
    });
    expect(result).toMatchObject({ channel: "SMS", status: "PENDING", queued: true });
  });

  it("sends inline and returns the resulting status when the queue is off", async () => {
    queueMock.isQueueEnabled.mockReturnValue(false);
    prismaMock.notificationDeliveryLog.findUnique
      .mockResolvedValueOnce(failedEmailLog())
      .mockResolvedValueOnce({ status: "DELIVERED" }); // re-read after processEmailJob

    const result = await retryDelivery("log-1");

    expect(queueMock.processEmailJob).toHaveBeenCalledTimes(1);
    expect(queueMock.reenqueueEmailJob).not.toHaveBeenCalled();
    expect(result).toMatchObject({ channel: "EMAIL", status: "DELIVERED", queued: false });
  });

  it("rejects a missing delivery log with 404", async () => {
    prismaMock.notificationDeliveryLog.findUnique.mockResolvedValue(null);
    await expect(retryDelivery("nope")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("rejects a non-FAILED delivery with 400", async () => {
    prismaMock.notificationDeliveryLog.findUnique.mockResolvedValue(
      failedEmailLog({ status: "DELIVERED" }),
    );
    await expect(retryDelivery("log-1")).rejects.toMatchObject({ statusCode: 400 });
    expect(queueMock.reenqueueEmailJob).not.toHaveBeenCalled();
  });

  it("rejects retrying an IN_APP delivery with 400", async () => {
    prismaMock.notificationDeliveryLog.findUnique.mockResolvedValue(
      failedEmailLog({ channel: "IN_APP" }),
    );
    await expect(retryDelivery("log-1")).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects an EMAIL retry when the recipient has no email", async () => {
    const log = failedEmailLog();
    log.notification.user.email = null as unknown as string;
    prismaMock.notificationDeliveryLog.findUnique.mockResolvedValue(log);
    await expect(retryDelivery("log-1")).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("GET /api/admin/notifications", () => {
  let listHandler: (event: H3Event) => Promise<unknown>;
  let currentQuery: Record<string, unknown> = {};

  beforeEach(async () => {
    currentQuery = {};
    vi.stubGlobal("getQuery", () => currentQuery);
    listHandler = (await import("~/server/api/admin/notifications/index.get")).default;
    prismaMock.userRole.findMany.mockResolvedValue([{ role: { name: "admin" } }]);
    prismaMock.notificationDeliveryLog.findMany.mockResolvedValue([]);
    prismaMock.notificationDeliveryLog.count.mockResolvedValue(0);
  });

  const eventWith = (auth: unknown) => ({ context: { auth } }) as unknown as H3Event;

  it("rejects unauthenticated callers with 401", async () => {
    await expect(listHandler(eventWith(undefined))).rejects.toMatchObject({ statusCode: 401 });
  });

  it("rejects non-admins with 403", async () => {
    prismaMock.userRole.findMany.mockResolvedValue([{ role: { name: "applicant" } }]);
    await expect(
      listHandler(eventWith({ userId: "u1", email: "a@b.c", roles: ["applicant"] })),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("builds the where-clause from valid filters and ignores invalid enums", async () => {
    currentQuery = { status: "FAILED", channel: "EMAIL", type: "REVIEW_APPROVED", search: "jane" };
    await listHandler(eventWith({ userId: "admin", email: "a@b.c", roles: ["admin"] }));

    const where = prismaMock.notificationDeliveryLog.findMany.mock.calls[0]![0].where;
    expect(where.status).toBe("FAILED");
    expect(where.channel).toBe("EMAIL");
    expect(where.notification.type).toBe("REVIEW_APPROVED");
    expect(where.notification.OR).toEqual(
      expect.arrayContaining([{ title: { contains: "jane", mode: "insensitive" } }]),
    );
  });

  it("drops bogus enum filter values rather than passing them to Prisma", async () => {
    currentQuery = { status: "NONSENSE", channel: "PIGEON" };
    await listHandler(eventWith({ userId: "admin", email: "a@b.c", roles: ["admin"] }));
    const where = prismaMock.notificationDeliveryLog.findMany.mock.calls[0]![0].where;
    expect(where.status).toBeUndefined();
    expect(where.channel).toBeUndefined();
  });
});

describe("POST /api/admin/notifications/[id]/retry", () => {
  let retryHandler: (event: H3Event) => Promise<unknown>;

  beforeEach(async () => {
    vi.doMock("~/server/services/notification.service", () => ({ retryDelivery: retryDeliveryMock }));
    vi.doMock("~/server/utils/audit", async () => {
      const actual = await vi.importActual<typeof import("~/server/utils/audit")>("~/server/utils/audit");
      return { ...actual, createAuditLog: createAuditLogMock };
    });
    vi.stubGlobal("getRouterParam", () => "log-1");
    retryHandler = (await import("~/server/api/admin/notifications/[id]/retry.post")).default;
    prismaMock.userRole.findMany.mockResolvedValue([{ role: { name: "admin" } }]);
    retryDeliveryMock.mockResolvedValue({ deliveryLogId: "log-1", channel: "EMAIL", status: "PENDING", queued: true });
    createAuditLogMock.mockResolvedValue(undefined);
  });

  afterEach(() => vi.doUnmock("~/server/services/notification.service"));

  const eventWith = (auth: unknown) => ({ context: { auth } }) as unknown as H3Event;

  it("retries and writes an audit log", async () => {
    const res = await retryHandler(eventWith({ userId: "admin", email: "a@b.c", roles: ["admin"] }));

    expect(retryDeliveryMock).toHaveBeenCalledWith("log-1");
    expect(createAuditLogMock).toHaveBeenCalledTimes(1);
    const auditArg = createAuditLogMock.mock.calls[0]![1];
    expect(auditArg.action).toBe("notification_delivery_retried");
    expect(auditArg.entityType).toBe("notification_delivery_log");
    expect(auditArg.entityId).toBe("log-1");
    expect(res).toMatchObject({ success: true, data: { channel: "EMAIL", status: "PENDING" } });
  });

  it("rejects non-admins with 403 and never retries", async () => {
    prismaMock.userRole.findMany.mockResolvedValue([{ role: { name: "applicant" } }]);
    await expect(
      retryHandler(eventWith({ userId: "u1", email: "a@b.c", roles: ["applicant"] })),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(retryDeliveryMock).not.toHaveBeenCalled();
  });
});
