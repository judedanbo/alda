// Shared types for the ADLA help system. Pure type declarations — no runtime
// code — so they can be imported from both the data layer and Vue components.

export type HelpRole = "applicant" | "schedule_officer" | "legal_unit" | "admin";

export type HelpCategory =
  | "getting-started"
  | "declarations"
  | "verification"
  | "reviews"
  | "form-handling"
  | "administration"
  | "account"
  | "troubleshooting";

export type HelpNoteVariant = "info" | "warning" | "tip";

// Structured content block — keeps article/contextual bodies HTML-free and
// type-safe. Rendered by HelpArticleBody.vue.
export type HelpBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "list"; ordered?: boolean; items: string[] }
  | { type: "note"; variant: HelpNoteVariant; text: string }
  | { type: "steps"; guideId: string }
  | { type: "link"; label: string; to: string; external?: boolean };

export interface HelpArticle {
  id: string;
  title: string;
  summary: string;
  body: HelpBlock[];
  // Empty array means the article is common to every role.
  roles: HelpRole[];
  category: HelpCategory;
  keywords?: string[];
  relatedGuideIds?: string[];
  relatedArticleIds?: string[];
  updatedAt?: string;
}

export interface HelpGuideStep {
  title: string;
  detail: string;
  note?: { variant: HelpNoteVariant; text: string };
}

export interface HelpGuide {
  id: string;
  title: string;
  description: string;
  roles: HelpRole[];
  category: HelpCategory;
  estimatedMinutes?: number;
  steps: HelpGuideStep[];
  relatedTourId?: string;
}

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  roles: HelpRole[];
  category: HelpCategory;
  keywords?: string[];
}

export interface GlossaryTerm {
  id: string;
  term: string;
  definition: string;
  aliases?: string[];
  // Omitted means the term applies to every role.
  roles?: HelpRole[];
}

// Maps a route to the help shown in the contextual "?" slide-over.
export interface ContextualHelp {
  // Matched against route.path. Supports ":param" segments and a trailing "/*".
  routePattern: string;
  title: string;
  summary: string;
  blocks: HelpBlock[];
  articleIds?: string[];
  guideIds?: string[];
  tourId?: string;
  roles?: HelpRole[];
}

export interface TourStep {
  // CSS selector targeting a data-tour attribute, e.g. [data-tour="x"].
  // Omit for a centered intro/outro step.
  element?: string;
  title: string;
  description: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}

export interface TourDefinition {
  id: string;
  title: string;
  description: string;
  roles: HelpRole[];
  // Route the tour expects to run on; useTour navigates here before launching.
  route?: string;
  steps: TourStep[];
}

export type OnboardingSignal =
  | "emailVerified"
  | "phoneVerified"
  | "profileCreated"
  | "profileVerified"
  | "hasActiveDeclaration";

export type OnboardingCompletion = "auto" | "manual" | "action";

export interface OnboardingItem {
  id: string;
  label: string;
  description: string;
  completion: OnboardingCompletion;
  // For "auto" items — the live signal that marks them complete.
  completionKey?: OnboardingSignal;
  // For "action" items — where the action button goes.
  actionTo?: string;
  actionTourId?: string;
  actionLabel?: string;
}

export interface OnboardingChecklist {
  role: HelpRole;
  title: string;
  description: string;
  items: OnboardingItem[];
}

export interface FieldTooltip {
  // Stable key, e.g. "profile.ghanaCardNumber".
  id: string;
  text: string;
}

export interface RoleMeta {
  id: HelpRole;
  label: string;
  description: string;
  icon: string;
}

export type HelpSearchKind = "article" | "guide" | "faq" | "glossary";

export interface HelpSearchResult {
  kind: HelpSearchKind;
  id: string;
  title: string;
  snippet: string;
  to: string;
}
