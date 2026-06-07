/**
 * Output-contract guard for admin/reports.get after the SQL-aggregate +
 * parallelize + cache rewrite. Mocks every query (including the two
 * $queryRaw aggregates) and asserts the response shape/mapping is unchanged.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  userRole: { findMany: vi.fn(), groupBy: vi.fn() },
  declaration: { groupBy: vi.fn() },
  role: { findMany: vi.fn() },
  applicantOffice: { groupBy: vi.fn() },
  institution: { findMany: vi.fn() },
  $queryRaw: vi.fn(),
}));
const getQueryMock = vi.hoisted(() => vi.fn());

vi.mock("~/server/utils/prisma", () => ({ default: prismaMock }));
// getCached → passthrough so the compute function always runs (no Redis in tests).
vi.mock("~/server/utils/analytics-cache", () => ({
  getCached: <T>(_key: string, _ttl: number, fn: () => Promise<T>) => fn(),
}));
vi.stubGlobal("getQuery", getQueryMock);

const handler = (await import("~/server/api/admin/reports.get")).default;

function adminEvent() {
  return {
    context: { auth: { userId: "admin-1", email: "a@x.gh", roles: ["admin"] } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  getQueryMock.mockReturnValue({});
  prismaMock.userRole.findMany.mockResolvedValue([{ role: { name: "admin" } }]);
  prismaMock.declaration.groupBy.mockResolvedValue([
    { status: "APPROVED", _count: { status: 5 } },
    { status: "SEALED", _count: { status: 3 } },
  ]);
  prismaMock.userRole.groupBy.mockResolvedValue([{ roleId: 1, _count: { roleId: 3 } }]);
  prismaMock.role.findMany.mockResolvedValue([{ id: 1, name: "admin" }]);
  prismaMock.applicantOffice.groupBy.mockResolvedValue([
    { institutionId: "inst-1", _count: { institutionId: 4 } },
  ]);
  prismaMock.institution.findMany.mockResolvedValue([{ id: "inst-1", name: "Ghana Health Service" }]);
  // $queryRaw is called twice: monthly rows first, then the processing-times row.
  prismaMock.$queryRaw
    .mockResolvedValueOnce([{ month: "2026-01", count: 2 }])
    .mockResolvedValueOnce([{ avg_submission_to_review: 10.4, avg_review_to_receipt: 5.6 }]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/admin/reports", () => {
  it("403s for a non-admin caller", async () => {
    prismaMock.userRole.findMany.mockResolvedValue([{ role: { name: "applicant" } }]);
    await expect(handler(adminEvent())).rejects.toMatchObject({ statusCode: 403 });
  });

  it("maps every section of the response correctly", async () => {
    const res = await handler(adminEvent());

    expect(res.success).toBe(true);
    expect(res.data).toEqual({
      declarationsByStatus: [
        { status: "APPROVED", count: 5 },
        { status: "SEALED", count: 3 },
      ],
      declarationsByMonth: [{ month: "2026-01", count: 2 }],
      usersByRole: [{ role: "admin", count: 3 }],
      topInstitutions: [{ name: "Ghana Health Service", count: 4 }],
      processingTimes: {
        avgSubmissionToReview: 10, // Math.round(10.4)
        avgReviewToReceipt: 6, // Math.round(5.6)
      },
    });
  });

  it("issues all independent queries (parallel fan-out preserved)", async () => {
    await handler(adminEvent());

    expect(prismaMock.declaration.groupBy).toHaveBeenCalledTimes(1);
    expect(prismaMock.userRole.groupBy).toHaveBeenCalledTimes(1);
    expect(prismaMock.role.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.applicantOffice.groupBy).toHaveBeenCalledTimes(1);
    expect(prismaMock.institution.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it("defaults to 0 processing times when the aggregate row is empty", async () => {
    prismaMock.$queryRaw
      .mockReset()
      .mockResolvedValueOnce([{ month: "2026-01", count: 2 }])
      .mockResolvedValueOnce([{ avg_submission_to_review: null, avg_review_to_receipt: null }]);

    const res = await handler(adminEvent());

    expect(res.data.processingTimes).toEqual({
      avgSubmissionToReview: 0,
      avgReviewToReceipt: 0,
    });
  });
});
