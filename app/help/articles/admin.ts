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
          "Users — create accounts, assign roles, assign schedule officers to collection offices, and activate or deactivate users.",
          "Institutions — maintain the list of institutions applicants belong to.",
          "Categories — maintain the public-office categories and their article references.",
          "Settings — override runtime behaviour such as the email and phone verification requirements.",
          "Notifications — monitor delivery, retry failures, and manage email/SMS settings.",
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
        type: "heading",
        text: "Collection offices for schedule officers",
      },
      {
        type: "paragraph",
        text: "A schedule officer must be assigned at least one collection office — set this on the Offices tab of the user (\"Save offices\"), or when creating the user. The assignment scopes the officer: they can only record collections and returns, review, and issue receipts for declarations belonging to their assigned offices. Admins are not scoped and can act on any office.",
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
  {
    id: "admin-settings",
    title: "Global settings",
    summary: "Override runtime behaviour without a redeploy.",
    roles: ["admin"],
    category: "administration",
    keywords: [
      "settings",
      "verification",
      "toggle",
      "runtime",
      "csp",
      "rate limit",
    ],
    body: [
      {
        type: "paragraph",
        text: "The Settings page lets you override global operational behaviour at runtime. Each setting can be set in-app or left to fall back to the deployment's environment value — a badge shows which source is currently in effect, and you can revert any setting to its environment default.",
      },
      {
        type: "list",
        items: [
          "Require email / phone verification for login.",
          "Require email / phone verification before creating a declaration.",
          "Enforce the Content-Security-Policy (rather than report-only).",
          "Notification rate limit per user, per hour.",
          "Only send email / SMS to verified addresses and numbers.",
        ],
      },
      {
        type: "note",
        variant: "info",
        text: "This page covers operational toggles only. Email (SMTP) and SMS provider credentials are managed on the Notifications page, under its Settings tab.",
      },
    ],
  },
  {
    id: "admin-notifications",
    title: "Monitoring notifications",
    summary: "Track delivery, retry failures, and manage email/SMS settings.",
    roles: ["admin"],
    category: "administration",
    keywords: [
      "notifications",
      "delivery",
      "retry",
      "smtp",
      "sms",
      "email",
      "logs",
    ],
    body: [
      {
        type: "paragraph",
        text: "The Notifications page is where you monitor and manage how the portal reaches users. It is organised into tabs.",
      },
      {
        type: "list",
        items: [
          "Overview — delivery rate and delivered/failed/pending counts, with trend charts by channel and failing type.",
          "Log — a filterable, paginated record of every notification. Filter by status, channel, type, or date; open a row to see the provider response; retry a failed email or SMS.",
          "Settings — the Email (SMTP) and SMS provider credentials, each overridable in-app with an environment fallback, plus a \"Check email delivery\" probe.",
          "Tools — send a test notification to confirm delivery end to end.",
        ],
      },
      {
        type: "note",
        variant: "tip",
        text: "If notifications are not arriving, check the Settings tab credentials and run \"Check email delivery\", then retry failed items from the Log.",
      },
    ],
  },
];
