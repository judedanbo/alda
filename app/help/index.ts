// Pure lookup and search helpers for the ADLA help system.
//
// Nothing in this file imports Vue or Nuxt — it is plain data + functions so it
// can be unit-tested directly and imported from anywhere.

import { commonArticles } from "./articles/common";
import { applicantArticles } from "./articles/applicant";
import { officerArticles } from "./articles/officer";
import { legalArticles } from "./articles/legal";
import { adminArticles } from "./articles/admin";
import { applicantGuides } from "./guides/applicant";
import { officerGuides } from "./guides/officer";
import { legalGuides } from "./guides/legal";
import { adminGuides } from "./guides/admin";
import { faqEntries } from "./faq";
import { glossaryTerms } from "./glossary";
import { contextualHelp } from "./contextual";
import { tours } from "./tours";
import { onboardingChecklists } from "./onboarding";
import { fieldTooltips } from "./tooltips";
import type {
  ContextualHelp,
  FaqEntry,
  GlossaryTerm,
  HelpArticle,
  HelpGuide,
  HelpRole,
  HelpSearchResult,
  TourDefinition,
} from "./types";

export * from "./types";
export * from "./onboarding-eval";
export { HELP_ROLES, ROLE_META, ROLE_DASHBOARD, roleLabel } from "./roles";
export { contextualHelp, tours, onboardingChecklists };

// --- Flattened collections -------------------------------------------------

export const allArticles: HelpArticle[] = [
  ...commonArticles,
  ...applicantArticles,
  ...officerArticles,
  ...legalArticles,
  ...adminArticles,
];

export const allGuides: HelpGuide[] = [
  ...applicantGuides,
  ...officerGuides,
  ...legalGuides,
  ...adminGuides,
];

export const allFaqs: FaqEntry[] = faqEntries;

export const glossary: GlossaryTerm[] = [...glossaryTerms].sort((a, b) =>
  a.term.localeCompare(b.term),
);

export const fieldTooltipMap: Record<string, string> = Object.fromEntries(
  fieldTooltips.map((t) => [t.id, t.text]),
);

// --- Role helpers ----------------------------------------------------------

/** True when content scoped by `roles` applies to `role`. Empty/undefined = all. */
export function appliesToRole(
  roles: HelpRole[] | undefined,
  role: HelpRole,
): boolean {
  return !roles || roles.length === 0 || roles.includes(role);
}

export function getArticlesForRole(role: HelpRole): HelpArticle[] {
  return allArticles.filter((a) => appliesToRole(a.roles, role));
}

export function getGuidesForRole(role: HelpRole): HelpGuide[] {
  return allGuides.filter((g) => appliesToRole(g.roles, role));
}

export function getFaqsForRole(role: HelpRole): FaqEntry[] {
  return allFaqs.filter((f) => appliesToRole(f.roles, role));
}

export function getGlossaryForRole(role: HelpRole): GlossaryTerm[] {
  return glossary.filter((t) => appliesToRole(t.roles, role));
}

// --- By-id lookups ---------------------------------------------------------

export function getArticleById(id: string): HelpArticle | undefined {
  return allArticles.find((a) => a.id === id);
}

export function getGuideById(id: string): HelpGuide | undefined {
  return allGuides.find((g) => g.id === id);
}

export function getTourById(id: string): TourDefinition | undefined {
  return tours.find((t) => t.id === id);
}

export function getFieldTooltip(id: string): string | undefined {
  return fieldTooltipMap[id];
}

// --- Contextual help route matching ---------------------------------------

/** Strip query/hash and any trailing slash (except the root). */
export function normalizePath(path: string): string {
  let p = path.split("?")[0]!.split("#")[0]!;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p || "/";
}

/**
 * Match a route pattern against a path. Returns a specificity score, or -1 for
 * no match. Literal segments score higher than ":param" segments; a trailing
 * "/*" wildcard adds no score, so an exact pattern always beats a wildcard.
 */
export function matchRoutePattern(pattern: string, path: string): number {
  const wildcard = pattern.endsWith("/*");
  const base = wildcard ? pattern.slice(0, -2) : pattern;
  const patternSegs = base.split("/").filter(Boolean);
  const pathSegs = normalizePath(path).split("/").filter(Boolean);

  if (wildcard) {
    if (pathSegs.length < patternSegs.length) return -1;
  } else if (pathSegs.length !== patternSegs.length) {
    return -1;
  }

  let score = 0;
  for (let i = 0; i < patternSegs.length; i++) {
    const ps = patternSegs[i]!;
    const xs = pathSegs[i]!;
    if (ps.startsWith(":")) {
      score += 1;
    } else if (ps === xs) {
      score += 2;
    } else {
      return -1;
    }
  }
  return score;
}

/** Find the most specific contextual help entry for a route path. */
export function getContextualHelp(path: string): ContextualHelp | undefined {
  let best: ContextualHelp | undefined;
  let bestScore = -1;
  for (const entry of contextualHelp) {
    const score = matchRoutePattern(entry.routePattern, path);
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  return bestScore >= 0 ? best : undefined;
}

// --- Search ----------------------------------------------------------------

function truncate(text: string, max = 140): string {
  return text.length <= max ? text : text.slice(0, max - 1).trimEnd() + "…";
}

/** Match when every whitespace-separated term appears in the haystack. */
function matchesQuery(haystack: string, terms: string[]): boolean {
  return terms.every((t) => haystack.includes(t));
}

/**
 * Search articles, guides, FAQs, and glossary. When `role` is given, results
 * are limited to content that applies to that role (common content included).
 */
export function searchHelp(query: string, role?: HelpRole): HelpSearchResult[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  const results: HelpSearchResult[] = [];

  for (const a of allArticles) {
    if (role && !appliesToRole(a.roles, role)) continue;
    const haystack = [
      a.title,
      a.summary,
      ...(a.keywords ?? []),
      ...a.body.flatMap((b) =>
        "text" in b ? [b.text] : "items" in b ? b.items : [],
      ),
    ]
      .join(" ")
      .toLowerCase();
    if (matchesQuery(haystack, terms)) {
      results.push({
        kind: "article",
        id: a.id,
        title: a.title,
        snippet: truncate(a.summary),
        to: `/help/articles/${a.id}`,
      });
    }
  }

  for (const g of allGuides) {
    if (role && !appliesToRole(g.roles, role)) continue;
    const haystack = [g.title, g.description, ...g.steps.map((s) => s.title)]
      .join(" ")
      .toLowerCase();
    if (matchesQuery(haystack, terms)) {
      results.push({
        kind: "guide",
        id: g.id,
        title: g.title,
        snippet: truncate(g.description),
        to: `/help/guides/${g.id}`,
      });
    }
  }

  for (const f of allFaqs) {
    if (role && !appliesToRole(f.roles, role)) continue;
    const haystack = [f.question, f.answer, ...(f.keywords ?? [])]
      .join(" ")
      .toLowerCase();
    if (matchesQuery(haystack, terms)) {
      results.push({
        kind: "faq",
        id: f.id,
        title: f.question,
        snippet: truncate(f.answer),
        to: "/help?tab=faq",
      });
    }
  }

  for (const t of glossary) {
    if (role && !appliesToRole(t.roles, role)) continue;
    const haystack = [t.term, t.definition, ...(t.aliases ?? [])]
      .join(" ")
      .toLowerCase();
    if (matchesQuery(haystack, terms)) {
      results.push({
        kind: "glossary",
        id: t.id,
        title: t.term,
        snippet: truncate(t.definition),
        to: `/help/glossary#${t.id}`,
      });
    }
  }

  return results;
}
