/**
 * Validates the SQL aggregates in admin/reports.get against a real Postgres:
 * the date_trunc monthly GROUP BY and the LATERAL-join processing-time
 * averages must equal the hand-computed values from the deterministic fixture.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import prisma from "~/server/utils/prisma";
import { seedFixture, type SeededFixture } from "./fixture";

// Bypass Redis caching; the compute function runs the real SQL via prisma.
// (vitest hoists vi.mock above all imports, so placement here is cosmetic.)
vi.mock("~/server/utils/analytics-cache", () => ({
  getCached: <T>(_key: string, _ttl: number, fn: () => Promise<T>) => fn(),
}));

const handler = (await import("~/server/api/admin/reports.get")).default;

let fx!: SeededFixture;

beforeAll(async () => {
  fx = await seedFixture();
});

afterAll(async () => {
  await prisma.$disconnect();
});

const adminEvent = () =>
  ({ context: { auth: { userId: fx.adminUserId, roles: ["admin"] } } }) as never;

describe("GET /api/admin/reports (real SQL aggregates)", () => {
  it("computes the monthly grouping via date_trunc", async () => {
    const res = await handler(adminEvent());
    expect(res.data.declarationsByMonth).toEqual([
      { month: fx.expectedMonth, count: fx.expectedDeclarationCount },
    ]);
  });

  it("computes processing-time averages via the LATERAL joins", async () => {
    const res = await handler(adminEvent());
    expect(res.data.processingTimes).toEqual({
      avgSubmissionToReview: fx.expectedAvgSubmissionToReview,
      avgReviewToReceipt: fx.expectedAvgReviewToReceipt,
    });
  });

  it("groups status and institutions correctly", async () => {
    const res = await handler(adminEvent());
    expect(res.data.declarationsByStatus).toEqual(
      expect.arrayContaining([{ status: "SEALED", count: 2 }]),
    );
    expect(res.data.topInstitutions).toEqual(
      expect.arrayContaining([{ name: fx.institutionName, count: 1 }]),
    );
  });
});
