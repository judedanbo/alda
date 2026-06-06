import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Job } from "bullmq";

/**
 * Mock Prisma at module load so processAuditJob's `prisma.auditLog.create`
 * goes through the test double. Same `vi.mock` pattern used by
 * test/auth-lockout.test.ts and test/officer-scope.test.ts.
 */
const mockCreate = vi.fn();

vi.mock("~/server/utils/prisma", () => ({
  default: {
    auditLog: { create: mockCreate },
  },
}));

const { processAuditJob } = await import("~/server/utils/audit-queue");
type AuditJobData = Parameters<typeof processAuditJob>[0]["data"];

beforeEach(() => {
  mockCreate.mockReset();
  mockCreate.mockResolvedValue({ id: "audit-row-id" });
});

function makeJob(overrides: Partial<AuditJobData> = {}): { data: AuditJobData } {
  return {
    data: {
      userId: "u-1",
      action: "user_login",
      entityType: "user",
      entityId: "u-1",
      oldValues: undefined,
      newValues: { reason: "success" },
      ipAddress: "1.2.3.4",
      userAgent: "test/1.0",
      sessionId: "sess-123",
      occurredAt: "2026-05-26T08:30:00.000Z",
      ...overrides,
    },
  };
}

describe("processAuditJob", () => {
  it("writes every payload field through to Prisma's create.data", async () => {
    await processAuditJob(makeJob());
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const arg = mockCreate.mock.calls[0]![0];
    expect(arg.data.userId).toBe("u-1");
    expect(arg.data.action).toBe("user_login");
    expect(arg.data.entityType).toBe("user");
    expect(arg.data.entityId).toBe("u-1");
    expect(arg.data.newValues).toEqual({ reason: "success" });
    expect(arg.data.ipAddress).toBe("1.2.3.4");
    expect(arg.data.userAgent).toBe("test/1.0");
    expect(arg.data.sessionId).toBe("sess-123");
  });

  it("threads occurredAt through to createdAt — Prisma's @default(now()) is overridden", async () => {
    await processAuditJob(makeJob({ occurredAt: "2026-05-26T08:30:00.000Z" }));
    const arg = mockCreate.mock.calls[0]![0];
    expect(arg.data.createdAt).toBeInstanceOf(Date);
    expect((arg.data.createdAt as Date).toISOString()).toBe("2026-05-26T08:30:00.000Z");
  });

  it("normalizes undefined oldValues / newValues to null for Prisma", async () => {
    await processAuditJob(makeJob({ oldValues: undefined, newValues: undefined }));
    const arg = mockCreate.mock.calls[0]![0];
    expect(arg.data.oldValues).toBeNull();
    expect(arg.data.newValues).toBeNull();
  });

  it("passes object oldValues / newValues through unchanged", async () => {
    await processAuditJob(makeJob({
      oldValues: { status: "PENDING" },
      newValues: { status: "APPROVED", reviewedAt: "2026-05-26" },
    }));
    const arg = mockCreate.mock.calls[0]![0];
    expect(arg.data.oldValues).toEqual({ status: "PENDING" });
    expect(arg.data.newValues).toEqual({ status: "APPROVED", reviewedAt: "2026-05-26" });
  });

  it("bubbles up Prisma errors so BullMQ retries", async () => {
    mockCreate.mockRejectedValueOnce(new Error("connection reset"));
    await expect(processAuditJob(makeJob())).rejects.toThrow("connection reset");
  });

  it("accepts a job shape that omits attemptsMade and the rest of the BullMQ Job API", async () => {
    // Confirms the function uses only `job.data` — important for the
    // inline-fallback path in createAuditLog which builds a synthetic
    // `{ data: job }` object instead of a real BullMQ Job.
    const minimal = { data: makeJob().data } as unknown as Pick<Job<AuditJobData>, "data">;
    await processAuditJob(minimal);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});
