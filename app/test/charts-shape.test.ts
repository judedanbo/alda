/**
 * Output-contract guard for analytics/declarations/charts.get after the
 * two-wave Promise.all refactor + extracted helper functions. Asserts the
 * { timeline, byInstitution, byCollectionOffice, officerPerformance } shape
 * maps the mocked queries correctly, including the empty-declIds short-circuit.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  declarationStatusHistory: { findMany: vi.fn() },
  applicantOffice: { groupBy: vi.fn() },
  institution: { findMany: vi.fn() },
  formCollection: { findMany: vi.fn() },
}));

vi.mock("~/server/utils/prisma", () => ({ default: prismaMock }));
vi.mock("~/server/utils/analytics-cache", () => ({
  getCached: <T>(_k: string, _t: number, fn: () => Promise<T>) => fn(),
  buildCacheKey: () => "test-key",
}));
vi.mock("~/server/utils/analytics-filters", () => ({
  parseFilters: () => ({}),
  getRoleScope: async () => ({ role: "admin", userId: "admin-1" }),
  buildSealedHistoryWhere: () => ({}),
}));

const handler = (await import("~/server/api/analytics/declarations/charts.get")).default;

const authEvent = () =>
  ({ context: { auth: { userId: "admin-1", roles: ["admin"] } } }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  // Wave 1 $queryRaw order: timeline, prevTimeline, officer.
  prismaMock.$queryRaw
    .mockResolvedValueOnce([{ bucket: new Date("2026-01-15T00:00:00Z"), count: 2 }])
    .mockResolvedValueOnce([{ bucket: new Date("2025-01-15T00:00:00Z"), count: 1 }])
    .mockResolvedValueOnce([
      { user_id: "u1", email: "officer@adla.gov.gh", count: 3, avg_days: 2.5 },
    ]);
  prismaMock.declarationStatusHistory.findMany.mockResolvedValue([{ declarationId: "d1" }]);
  prismaMock.applicantOffice.groupBy.mockResolvedValue([
    { institutionId: "inst-1", _count: { institutionId: 4 } },
  ]);
  prismaMock.institution.findMany.mockResolvedValue([{ id: "inst-1", name: "Ghana Health Service" }]);
  prismaMock.formCollection.findMany.mockResolvedValue([
    { collectionOffice: { type: "REGIONAL", region: "Greater Accra" } },
    { collectionOffice: { type: "REGIONAL", region: null } },
  ]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/analytics/declarations/charts", () => {
  it("maps timeline, institutions, collection offices, and officer performance", async () => {
    const res = await handler(authEvent());

    expect(res.success).toBe(true);
    expect(res.data.timeline).toEqual([{ month: "2026-01", count: 2, prevCount: 1 }]);
    expect(res.data.officerPerformance).toEqual([
      { name: "officer", count: 3, avgDays: 2.5 },
    ]);
    expect(res.data.byInstitution).toEqual([{ name: "Ghana Health Service", count: 4 }]);
    expect(res.data.byCollectionOffice).toEqual({
      byType: [{ type: "REGIONAL", count: 2 }],
      byRegion: [
        { region: "Greater Accra", count: 1 },
        { region: "Headquarters", count: 1 }, // null region → "Headquarters"
      ],
    });
  });

  it("short-circuits the declId-dependent charts when no sealed declarations exist", async () => {
    prismaMock.declarationStatusHistory.findMany.mockResolvedValue([]);

    const res = await handler(authEvent());

    expect(res.data.byInstitution).toEqual([]);
    expect(res.data.byCollectionOffice).toEqual({ byType: [], byRegion: [] });
    // The empty-declIds guard must avoid issuing the dependent queries.
    expect(prismaMock.applicantOffice.groupBy).not.toHaveBeenCalled();
    expect(prismaMock.formCollection.findMany).not.toHaveBeenCalled();
  });
});
