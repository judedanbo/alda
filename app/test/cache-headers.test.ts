/**
 * Regression guard for the Cache-Control headers added to the public
 * reference-data endpoints. If a refactor drops the header, repeat views
 * silently start hitting the DB again — these tests lock the directives.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  publicOfficeCategory: { findMany: vi.fn() },
  institution: { findMany: vi.fn() },
}));
const setResponseHeaderMock = vi.hoisted(() => vi.fn());
const getQueryMock = vi.hoisted(() => vi.fn());

vi.mock("~/server/utils/prisma", () => ({ default: prismaMock }));
vi.stubGlobal("setResponseHeader", setResponseHeaderMock);
vi.stubGlobal("getQuery", getQueryMock);

const categoriesHandler = (await import("~/server/api/categories/index.get")).default;
const institutionsHandler = (await import("~/server/api/institutions/index.get")).default;

const fakeEvent = () => ({ node: { req: {}, res: {} } }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.publicOfficeCategory.findMany.mockResolvedValue([]);
  prismaMock.institution.findMany.mockResolvedValue([]);
  getQueryMock.mockReturnValue({});
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/categories", () => {
  it("sets a public Cache-Control with stale-while-revalidate", async () => {
    await categoriesHandler(fakeEvent());

    expect(setResponseHeaderMock).toHaveBeenCalledWith(
      expect.anything(),
      "Cache-Control",
      "public, max-age=300, stale-while-revalidate=600",
    );
  });
});

describe("GET /api/institutions", () => {
  it("sets a public Cache-Control with stale-while-revalidate", async () => {
    await institutionsHandler(fakeEvent());

    expect(setResponseHeaderMock).toHaveBeenCalledWith(
      expect.anything(),
      "Cache-Control",
      "public, max-age=60, stale-while-revalidate=300",
    );
  });

  it("still applies the cache header on a ?search= request", async () => {
    getQueryMock.mockReturnValue({ search: "health" });

    await institutionsHandler(fakeEvent());

    expect(setResponseHeaderMock).toHaveBeenCalledWith(
      expect.anything(),
      "Cache-Control",
      "public, max-age=60, stale-while-revalidate=300",
    );
  });
});
