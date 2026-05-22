import { describe, it, expect } from "vitest";
import {
  getArticlesForRole,
  getGuidesForRole,
  getFaqsForRole,
  getGlossaryForRole,
  getArticleById,
  getGuideById,
  getTourById,
  getFieldTooltip,
  getContextualHelp,
  matchRoutePattern,
  normalizePath,
  searchHelp,
  appliesToRole,
} from "~/help";

describe("appliesToRole", () => {
  it("treats empty or missing roles as common to all", () => {
    expect(appliesToRole([], "applicant")).toBe(true);
    expect(appliesToRole(undefined, "admin")).toBe(true);
  });

  it("scopes to the listed roles otherwise", () => {
    expect(appliesToRole(["admin"], "admin")).toBe(true);
    expect(appliesToRole(["admin"], "applicant")).toBe(false);
  });
});

describe("role-scoped collections", () => {
  it("includes common articles for every role", () => {
    const ids = getArticlesForRole("officer" as never).map((a) => a.id);
    // common-welcome has roles: [] so it is in every role's set
    expect(getArticlesForRole("admin").some((a) => a.id === "common-welcome")).toBe(
      true,
    );
    expect(ids).toBeDefined();
  });

  it("excludes other roles' articles", () => {
    const adminArticleIds = getArticlesForRole("admin").map((a) => a.id);
    expect(adminArticleIds).not.toContain("applicant-getting-started");
    expect(adminArticleIds).toContain("admin-getting-started");
  });

  it("filters guides, faqs and glossary by role", () => {
    expect(getGuidesForRole("legal_unit").every((g) =>
      g.roles.length === 0 || g.roles.includes("legal_unit"),
    )).toBe(true);
    expect(getFaqsForRole("applicant").some((f) => f.id === "faq-lost-form")).toBe(
      true,
    );
    expect(getGlossaryForRole("applicant").length).toBeGreaterThan(0);
  });
});

describe("by-id lookups", () => {
  it("finds existing entries", () => {
    expect(getArticleById("common-welcome")?.title).toBeTruthy();
    expect(getGuideById("guide-applicant-register")?.steps.length).toBeGreaterThan(0);
    expect(getTourById("tour-applicant-getting-started")?.roles).toContain(
      "applicant",
    );
  });

  it("returns undefined for unknown ids", () => {
    expect(getArticleById("nope")).toBeUndefined();
    expect(getGuideById("nope")).toBeUndefined();
    expect(getTourById("nope")).toBeUndefined();
  });
});

describe("getFieldTooltip", () => {
  it("resolves known field ids", () => {
    expect(getFieldTooltip("profile.ghanaCardNumber")).toMatch(/Ghana Card/i);
  });

  it("returns undefined for unknown field ids", () => {
    expect(getFieldTooltip("profile.unknown")).toBeUndefined();
  });
});

describe("normalizePath", () => {
  it("strips query, hash and trailing slash", () => {
    expect(normalizePath("/admin/users/")).toBe("/admin/users");
    expect(normalizePath("/admin/users?tab=1")).toBe("/admin/users");
    expect(normalizePath("/help#section")).toBe("/help");
    expect(normalizePath("/")).toBe("/");
  });
});

describe("matchRoutePattern", () => {
  it("scores exact matches above wildcards", () => {
    const exact = matchRoutePattern("/admin/users", "/admin/users");
    const wild = matchRoutePattern("/admin/*", "/admin/users");
    expect(exact).toBeGreaterThan(wild);
    expect(wild).toBeGreaterThanOrEqual(0);
  });

  it("matches :param segments", () => {
    expect(
      matchRoutePattern("/applicant/declaration/:id", "/applicant/declaration/abc"),
    ).toBeGreaterThanOrEqual(0);
  });

  it("returns -1 for no match", () => {
    expect(matchRoutePattern("/admin/users", "/admin/roles")).toBe(-1);
    expect(matchRoutePattern("/admin/users", "/admin")).toBe(-1);
  });
});

describe("getContextualHelp", () => {
  it("returns an exact-route entry", () => {
    expect(getContextualHelp("/officer/reviews")?.routePattern).toBe(
      "/officer/reviews",
    );
  });

  it("prefers the most specific match over a :param entry", () => {
    expect(getContextualHelp("/applicant/declaration/new")?.routePattern).toBe(
      "/applicant/declaration/new",
    );
    expect(getContextualHelp("/applicant/declaration/xyz123")?.routePattern).toBe(
      "/applicant/declaration/:id",
    );
  });

  it("matches wildcard routes", () => {
    expect(getContextualHelp("/applicant/profile/edit")?.routePattern).toBe(
      "/applicant/profile/*",
    );
  });

  it("returns undefined for an unmapped route", () => {
    expect(getContextualHelp("/some/unmapped/route")).toBeUndefined();
  });
});

describe("searchHelp", () => {
  it("returns an empty array for a blank query", () => {
    expect(searchHelp("")).toEqual([]);
    expect(searchHelp("   ")).toEqual([]);
  });

  it("finds content by keyword", () => {
    const results = searchHelp("receipt");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.kind === "article" || r.kind === "guide")).toBe(
      true,
    );
  });

  it("scopes results to a role", () => {
    const adminResults = searchHelp("declaration", "admin");
    expect(
      adminResults.every((r) => r.to.startsWith("/help")),
    ).toBe(true);
    // an applicant-only article must not surface for an admin search
    const ids = searchHelp("reissue", "admin").map((r) => r.id);
    expect(ids).not.toContain("applicant-reissue");
  });
});
