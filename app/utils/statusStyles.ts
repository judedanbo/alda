/**
 * Tailwind class strings for workflow status badges and chips.
 *
 * Status hues stay consistent across every theme (green = approved everywhere)
 * so a stage is recognisable at a glance. The `dark:` variants keep the chips
 * legible on the Dark theme; the three light-based themes (Light, High
 * Contrast, Sepia, Solarized) reuse the light tints unchanged.
 */

/** Reusable tinted-chip classes keyed by a colour tone. */
export const TONE_BADGE: Record<string, string> = {
  neutral: "bg-muted text-muted-foreground",
  amber:
    "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-950/40 dark:text-amber-300",
  cyan: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300",
  orange: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
  green: "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300",
  emerald:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  red: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
};

/** Declaration workflow statuses → tinted-chip classes. */
export const DECLARATION_STATUS_BADGE: Record<string, string> = {
  CODE_GENERATED: TONE_BADGE.amber,
  FORM_COLLECTED: TONE_BADGE.cyan,
  SUBMITTED: TONE_BADGE.blue,
  UNDER_REVIEW: TONE_BADGE.purple,
  APPROVED: TONE_BADGE.green,
  REJECTED: TONE_BADGE.red,
  SEALED: TONE_BADGE.emerald,
};
