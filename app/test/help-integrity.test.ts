import { describe, it, expect } from "vitest";
import {
  allArticles,
  allGuides,
  allFaqs,
  glossary,
  contextualHelp,
  tours,
  onboardingChecklists,
  fieldTooltipMap,
  getArticleById,
  getGuideById,
  getTourById,
  HELP_ROLES,
} from "~/help";

function expectUnique(ids: string[], label: string) {
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) dupes.push(id);
    seen.add(id);
  }
  expect(dupes, `duplicate ${label} ids: ${dupes.join(", ")}`).toEqual([]);
}

describe("id uniqueness", () => {
  it("articles, guides, faqs, glossary, tours and tooltips have unique ids", () => {
    expectUnique(allArticles.map((a) => a.id), "article");
    expectUnique(allGuides.map((g) => g.id), "guide");
    expectUnique(allFaqs.map((f) => f.id), "faq");
    expectUnique(glossary.map((t) => t.id), "glossary");
    expectUnique(tours.map((t) => t.id), "tour");
    expectUnique(Object.keys(fieldTooltipMap), "tooltip");
  });
});

describe("cross-reference integrity", () => {
  it("article related ids resolve", () => {
    for (const a of allArticles) {
      for (const id of a.relatedArticleIds ?? []) {
        expect(getArticleById(id), `${a.id} -> article ${id}`).toBeDefined();
      }
      for (const id of a.relatedGuideIds ?? []) {
        expect(getGuideById(id), `${a.id} -> guide ${id}`).toBeDefined();
      }
      for (const block of a.body) {
        if (block.type === "steps") {
          expect(getGuideById(block.guideId), `${a.id} body -> guide`).toBeDefined();
        }
      }
    }
  });

  it("guide relatedTourId resolves", () => {
    for (const g of allGuides) {
      if (g.relatedTourId) {
        expect(getTourById(g.relatedTourId), `${g.id} -> tour`).toBeDefined();
      }
    }
  });

  it("contextual help references resolve", () => {
    for (const c of contextualHelp) {
      for (const id of c.articleIds ?? []) {
        expect(getArticleById(id), `${c.routePattern} -> article ${id}`).toBeDefined();
      }
      for (const id of c.guideIds ?? []) {
        expect(getGuideById(id), `${c.routePattern} -> guide ${id}`).toBeDefined();
      }
      if (c.tourId) {
        expect(getTourById(c.tourId), `${c.routePattern} -> tour`).toBeDefined();
      }
    }
  });

  it("onboarding action tours resolve", () => {
    for (const role of HELP_ROLES) {
      for (const item of onboardingChecklists[role].items) {
        if (item.actionTourId) {
          expect(
            getTourById(item.actionTourId),
            `${role}/${item.id} -> tour`,
          ).toBeDefined();
        }
      }
    }
  });
});

describe("tour step selectors", () => {
  it("every targeted step uses a [data-tour=\"...\"] selector", () => {
    const re = /^\[data-tour="[^"]+"\]$/;
    for (const tour of tours) {
      for (const step of tour.steps) {
        if (step.element !== undefined) {
          expect(re.test(step.element), `${tour.id}: ${step.element}`).toBe(true);
        }
      }
    }
  });
});

describe("onboarding coverage", () => {
  it("provides a checklist for every role", () => {
    for (const role of HELP_ROLES) {
      expect(onboardingChecklists[role]).toBeDefined();
      expect(onboardingChecklists[role].role).toBe(role);
      expect(onboardingChecklists[role].items.length).toBeGreaterThan(0);
    }
  });

  it("auto items declare a completion key", () => {
    for (const role of HELP_ROLES) {
      for (const item of onboardingChecklists[role].items) {
        if (item.completion === "auto") {
          expect(item.completionKey, `${role}/${item.id}`).toBeDefined();
        }
      }
    }
  });
});
