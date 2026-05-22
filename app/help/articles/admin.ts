import type { HelpArticle } from "../types";

export const adminArticles: HelpArticle[] = [
  {
    id: "admin-getting-started",
    title: "The Administrator role",
    summary: "What administrators can manage across the portal.",
    roles: ["admin"],
    category: "getting-started",
    keywords: ["overview", "admin", "administrator"],
    body: [
      {
        type: "paragraph",
        text: "Administrators have access to every part of the portal plus the system-management areas.",
      },
      {
        type: "list",
        items: [
          "Users — create accounts, assign roles, and activate or deactivate users.",
          "Institutions — maintain the list of institutions applicants belong to.",
          "Categories — maintain the public-office categories and their article references.",
          "Audit logs — review the immutable record of every action.",
          "Reports and analytics — monitor declarations and portal usage.",
        ],
      },
    ],
  },
  {
    id: "admin-users",
    title: "Managing users and roles",
    summary: "Creating users, assigning roles, and activating or deactivating accounts.",
    roles: ["admin"],
    category: "administration",
    keywords: ["users", "roles", "activate", "deactivate", "permissions"],
    relatedGuideIds: ["guide-admin-users"],
    body: [
      {
        type: "paragraph",
        text: "The Users page lists every account. You can filter by role or status and search by name or email.",
      },
      {
        type: "heading",
        text: "Roles",
      },
      {
        type: "paragraph",
        text: "There are four roles: applicant, schedule officer, legal unit, and admin. A user can hold more than one role. Assigning a role immediately changes which areas of the portal that user can reach.",
      },
      {
        type: "note",
        variant: "warning",
        text: "Deactivating a user prevents them from signing in. Their existing records remain intact and visible in audit logs.",
      },
    ],
  },
  {
    id: "admin-institutions-categories",
    title: "Institutions and categories",
    summary: "Maintaining the reference data applicants choose from.",
    roles: ["admin"],
    category: "administration",
    keywords: ["institutions", "categories", "reference data", "article reference"],
    body: [
      {
        type: "paragraph",
        text: "Applicants pick an institution and a public-office category when completing their profile. Keep both lists accurate and current.",
      },
      {
        type: "list",
        items: [
          "Institutions — add, edit, or deactivate the bodies applicants belong to.",
          "Categories — add or edit public-office categories, each with its Article 286(5) reference.",
        ],
      },
    ],
  },
  {
    id: "admin-audit-reports",
    title: "Audit logs and reports",
    summary: "Reviewing the audit trail and generating system reports.",
    roles: ["admin"],
    category: "administration",
    keywords: ["audit", "audit logs", "reports", "analytics", "compliance"],
    body: [
      {
        type: "heading",
        text: "Audit logs",
      },
      {
        type: "paragraph",
        text: "Every state-changing action is written to the audit log with the user, the action, the affected record, and a timestamp. Audit logs are immutable — they cannot be edited or deleted — and are a compliance requirement.",
      },
      {
        type: "heading",
        text: "Reports",
      },
      {
        type: "paragraph",
        text: "The Reports page summarises declarations by status and month, users by role, top institutions, and processing times. Analytics pages cover portal usage in more depth.",
      },
    ],
  },
];
