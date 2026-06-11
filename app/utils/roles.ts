/**
 * Canonical role metadata shared across the client.
 *
 * `ROLE_ORDER` is the precedence used to pick a user's default active role
 * (admin first, applicant last) — it mirrors the redirect precedence the auth
 * store and route middleware have always used.
 */
export const ROLE_ORDER = ["admin", "schedule_officer", "legal_unit", "applicant"] as const;

export type RoleName = (typeof ROLE_ORDER)[number];

export const ROLE_LABELS: Record<RoleName, string> = {
  admin: "Administrator",
  schedule_officer: "Schedule Officer",
  legal_unit: "Legal Unit",
  applicant: "Applicant",
};

export const ROLE_DASHBOARDS: Record<RoleName, string> = {
  admin: "/admin/dashboard",
  schedule_officer: "/officer/dashboard",
  legal_unit: "/legal/dashboard",
  applicant: "/applicant/dashboard",
};
