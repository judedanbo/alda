import type { HelpRole, RoleMeta } from "./types";

// The four ADLA actor types, in workflow order.
export const HELP_ROLES: HelpRole[] = [
  "applicant",
  "schedule_officer",
  "legal_unit",
  "admin",
];

export const ROLE_META: Record<HelpRole, RoleMeta> = {
  applicant: {
    id: "applicant",
    label: "Applicant",
    description:
      "Public officers who declare their assets — register, complete a profile, and create declarations.",
    icon: "user",
  },
  schedule_officer: {
    id: "schedule_officer",
    label: "Schedule Officer",
    description:
      "Audit Service officers who record form collection and return, review declarations, and issue receipts.",
    icon: "clipboard-check",
  },
  legal_unit: {
    id: "legal_unit",
    label: "Legal Unit",
    description:
      "Officers who verify applicant registrations, verify declaration codes, and process lost-form reissues.",
    icon: "scale",
  },
  admin: {
    id: "admin",
    label: "Administrator",
    description:
      "System administrators who manage users, institutions, categories, audit logs, and reports.",
    icon: "shield",
  },
};

// Where the "go to my area" link points for each role.
export const ROLE_DASHBOARD: Record<HelpRole, string> = {
  applicant: "/applicant/dashboard",
  schedule_officer: "/officer/dashboard",
  legal_unit: "/legal/dashboard",
  admin: "/admin/dashboard",
};

export function roleLabel(role: HelpRole): string {
  return ROLE_META[role].label;
}
