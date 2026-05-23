/**
 * Tests for the notifications:prune scheduled task.
 *
 * We just verify the SQL is shaped right — that read notifications
 * older than the read cutoff get pruned, and unread notifications
 * older than the unread cutoff get pruned, and the env overrides take
 * effect.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  notification: {
    deleteMany: vi.fn(),
  },
}));

vi.mock("~/server/utils/prisma", () => ({ default: prismaMock }));

const pruneTask = (await import("~/server/tasks/notifications/prune")).default;

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.notification.deleteMany.mockResolvedValue({ count: 3 });
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

describe("notifications:prune", () => {
  it("issues two delete calls (read + unread) with the right cutoffs", async () => {
    const before = Date.now();
    const result = await pruneTask.run({} as never);
    const after = Date.now();

    expect(prismaMock.notification.deleteMany).toHaveBeenCalledTimes(2);

    const calls = prismaMock.notification.deleteMany.mock.calls;
    const readCall = calls[0]![0];
    const unreadCall = calls[1]![0];

    expect(readCall.where.readAt.not).toBeNull();
    expect(readCall.where.readAt.lt).toBeInstanceOf(Date);

    expect(unreadCall.where.readAt).toBeNull();
    expect(unreadCall.where.createdAt.lt).toBeInstanceOf(Date);

    // Cutoffs roughly match the defaults (90 days for read, 180 unread).
    const readCutoffMs = readCall.where.readAt.lt.getTime();
    const unreadCutoffMs = unreadCall.where.createdAt.lt.getTime();
    const day = 86_400_000;
    expect(after - readCutoffMs).toBeGreaterThanOrEqual(90 * day);
    expect(before - readCutoffMs).toBeLessThanOrEqual(91 * day);
    expect(after - unreadCutoffMs).toBeGreaterThanOrEqual(180 * day);
    expect(before - unreadCutoffMs).toBeLessThanOrEqual(181 * day);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result as any).result).toBe("prune complete");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result as any).readPruned).toBe(3);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result as any).unreadPruned).toBe(3);
  });

  it("honours NOTIFICATIONS_READ_RETENTION_DAYS / UNREAD_RETENTION_DAYS env", async () => {
    process.env.NOTIFICATIONS_READ_RETENTION_DAYS = "7";
    process.env.NOTIFICATIONS_UNREAD_RETENTION_DAYS = "30";
    const before = Date.now();
    await pruneTask.run({} as never);
    const after = Date.now();

    const calls = prismaMock.notification.deleteMany.mock.calls;
    const readCutoffMs = calls[0]![0].where.readAt.lt.getTime();
    const unreadCutoffMs = calls[1]![0].where.createdAt.lt.getTime();
    const day = 86_400_000;
    expect(after - readCutoffMs).toBeGreaterThanOrEqual(7 * day);
    expect(before - readCutoffMs).toBeLessThanOrEqual(8 * day);
    expect(after - unreadCutoffMs).toBeGreaterThanOrEqual(30 * day);
    expect(before - unreadCutoffMs).toBeLessThanOrEqual(31 * day);
  });

  it("returns 'failed' (not throw) when prisma errors", async () => {
    prismaMock.notification.deleteMany.mockRejectedValueOnce(new Error("db down"));
    const result = await pruneTask.run({} as never);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result as any).result).toBe("failed");
  });

  it("ignores invalid env values and falls back to defaults", async () => {
    process.env.NOTIFICATIONS_READ_RETENTION_DAYS = "not-a-number";
    process.env.NOTIFICATIONS_UNREAD_RETENTION_DAYS = "0";

    const before = Date.now();
    await pruneTask.run({} as never);
    const after = Date.now();

    const calls = prismaMock.notification.deleteMany.mock.calls;
    const readCutoffMs = calls[0]![0].where.readAt.lt.getTime();
    const unreadCutoffMs = calls[1]![0].where.createdAt.lt.getTime();
    const day = 86_400_000;
    // Falls back to 90 / 180.
    expect(after - readCutoffMs).toBeGreaterThanOrEqual(90 * day);
    expect(before - readCutoffMs).toBeLessThanOrEqual(91 * day);
    expect(after - unreadCutoffMs).toBeGreaterThanOrEqual(180 * day);
    expect(before - unreadCutoffMs).toBeLessThanOrEqual(181 * day);
  });
});
