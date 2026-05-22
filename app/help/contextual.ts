import type { ContextualHelp } from "./types";

// Route-to-help mapping for the contextual "?" panel. Order does not matter —
// getContextualHelp() picks the most specific match. Patterns support ":param"
// segments and a trailing "/*" wildcard.
export const contextualHelp: ContextualHelp[] = [
  // --- Applicant -----------------------------------------------------------
  {
    routePattern: "/applicant/dashboard",
    title: "Your dashboard",
    summary: "A snapshot of your declarations and what to do next.",
    blocks: [
      {
        type: "paragraph",
        text: "Your dashboard shows your declaration totals, your active declaration and its code, and any banners about email or registration verification.",
      },
      {
        type: "note",
        variant: "tip",
        text: "Complete the onboarding checklist to reach your first declaration quickly.",
      },
    ],
    articleIds: ["applicant-getting-started"],
    guideIds: ["guide-applicant-register"],
    tourId: "tour-applicant-getting-started",
  },
  {
    routePattern: "/applicant/declarations",
    title: "My declarations",
    summary: "Every declaration you have created.",
    blocks: [
      {
        type: "paragraph",
        text: "This list shows all your declarations. Filter by status and open any one to see its full timeline.",
      },
    ],
    articleIds: ["applicant-declarations"],
  },
  {
    routePattern: "/applicant/declaration/new",
    title: "Create a declaration",
    summary: "Generate a unique code to begin a new declaration.",
    blocks: [
      {
        type: "paragraph",
        text: "Creating a declaration generates a unique code. Take that code to the Audit Service to collect your physical form.",
      },
      {
        type: "note",
        variant: "info",
        text: "You can only have one active declaration at a time.",
      },
    ],
    articleIds: ["applicant-declarations"],
    guideIds: ["guide-applicant-new-declaration"],
    tourId: "tour-applicant-new-declaration",
  },
  {
    routePattern: "/applicant/declaration/:id",
    title: "Declaration details",
    summary: "The status timeline and actions for one declaration.",
    blocks: [
      {
        type: "paragraph",
        text: "This page shows the declaration's status timeline. While it is at the Form Collected stage, you can request a lost-form reissue from here.",
      },
    ],
    articleIds: ["applicant-declarations", "applicant-reissue"],
    guideIds: ["guide-applicant-reissue"],
  },
  {
    routePattern: "/applicant/profile/*",
    title: "Your profile",
    summary: "The three-step profile the Legal Unit verifies.",
    blocks: [
      {
        type: "paragraph",
        text: "Complete your personal details, upload clear Ghana Card images, and enter your office details. The Legal Unit uses this to verify your registration.",
      },
      {
        type: "note",
        variant: "warning",
        text: "Blurred or cropped Ghana Card images are the most common cause of verification delays.",
      },
    ],
    articleIds: ["applicant-profile"],
    guideIds: ["guide-applicant-profile"],
  },
  // --- Officer -------------------------------------------------------------
  {
    routePattern: "/officer/dashboard",
    title: "Officer dashboard",
    summary: "Your work queues for each step of the declaration workflow.",
    blocks: [
      {
        type: "paragraph",
        text: "The dashboard shows a queue for each step — pending collections, returns, reviews, and receipts — plus a quick code lookup.",
      },
    ],
    articleIds: ["officer-getting-started"],
    tourId: "tour-officer-review",
  },
  {
    routePattern: "/officer/form-collections",
    title: "Form collections",
    summary: "Record that an applicant has collected their physical form.",
    blocks: [
      {
        type: "paragraph",
        text: "Find a declaration at the Code Generated stage, choose the collection office, and record the collection. This moves it to Form Collected.",
      },
    ],
    articleIds: ["officer-form-handling"],
    guideIds: ["guide-officer-form-collection"],
  },
  {
    routePattern: "/officer/form-returns",
    title: "Form returns",
    summary: "Record that a completed form has been returned.",
    blocks: [
      {
        type: "paragraph",
        text: "Find a declaration at the Form Collected stage and record the return. This moves it to Submitted, ready for review.",
      },
    ],
    articleIds: ["officer-form-handling"],
    guideIds: ["guide-officer-form-return"],
  },
  {
    routePattern: "/officer/reviews",
    title: "Reviews",
    summary: "Review declarations section by section.",
    blocks: [
      {
        type: "paragraph",
        text: "Work through the eight sections of a declaration. Mark each acceptable or flag it with a comment, then approve or reject the declaration.",
      },
    ],
    articleIds: ["officer-reviews"],
    guideIds: ["guide-officer-review"],
    tourId: "tour-officer-review",
  },
  {
    routePattern: "/officer/receipts",
    title: "Receipts",
    summary: "Generate the sealed receipt for an approved declaration.",
    blocks: [
      {
        type: "paragraph",
        text: "Generate a receipt for an Approved declaration. This produces the PDF receipt and moves the declaration to Sealed.",
      },
    ],
    articleIds: ["officer-receipts"],
    guideIds: ["guide-officer-receipt"],
  },
  // --- Legal ---------------------------------------------------------------
  {
    routePattern: "/legal/dashboard",
    title: "Legal Unit dashboard",
    summary: "Pending verifications and reissue requests at a glance.",
    blocks: [
      {
        type: "paragraph",
        text: "The dashboard summarises applicant verifications and form-reissue requests, with a quick code lookup.",
      },
    ],
    articleIds: ["legal-getting-started"],
  },
  {
    routePattern: "/legal/verifications/*",
    title: "Applicant verifications",
    summary: "Review registrations and record verification decisions.",
    blocks: [
      {
        type: "paragraph",
        text: "Open a registration to review the applicant's details and Ghana Card, then choose Verified, On Hold, More Information Required, or Rejected.",
      },
    ],
    articleIds: ["legal-verifications"],
    guideIds: ["guide-legal-verification"],
    tourId: "tour-legal-verification",
  },
  {
    routePattern: "/legal/verifications",
    title: "Applicant verifications",
    summary: "The queue of registrations awaiting verification.",
    blocks: [
      {
        type: "paragraph",
        text: "This queue lists applicant registrations by status. Open one to review and record a decision.",
      },
    ],
    articleIds: ["legal-verifications"],
    guideIds: ["guide-legal-verification"],
    tourId: "tour-legal-verification",
  },
  {
    routePattern: "/legal/form-reissues/*",
    title: "Form reissues",
    summary: "Process a lost-form reissue request.",
    blocks: [
      {
        type: "paragraph",
        text: "Open a pending request, upload the scanned approval letter, select the approver, and record the decision. An approved reissue keeps the declaration at Form Collected.",
      },
    ],
    articleIds: ["legal-reissues"],
    guideIds: ["guide-legal-reissue"],
  },
  {
    routePattern: "/legal/form-reissues",
    title: "Form reissues",
    summary: "The queue of lost-form reissue requests.",
    blocks: [
      {
        type: "paragraph",
        text: "This queue lists reissue requests by status. Open a Pending request to record the offline approval decision.",
      },
    ],
    articleIds: ["legal-reissues"],
    guideIds: ["guide-legal-reissue"],
  },
  {
    routePattern: "/legal/verify",
    title: "Verify a code",
    summary: "Confirm a declaration's authenticity from its unique code.",
    blocks: [
      {
        type: "paragraph",
        text: "Enter a unique code to see the applicant, the declaration's status and timeline, review comments, and the receipt if it is sealed.",
      },
    ],
    articleIds: ["legal-verify-code"],
  },
  // --- Admin ---------------------------------------------------------------
  {
    routePattern: "/admin/dashboard",
    title: "Admin dashboard",
    summary: "System-wide statistics and recent activity.",
    blocks: [
      {
        type: "paragraph",
        text: "The dashboard summarises users, declarations, and portal activity across the whole system.",
      },
    ],
    articleIds: ["admin-getting-started"],
    tourId: "tour-admin-overview",
  },
  {
    routePattern: "/admin/users",
    title: "User management",
    summary: "Create users, assign roles, and manage account status.",
    blocks: [
      {
        type: "paragraph",
        text: "List, filter, and search accounts. Assign roles to control access and activate or deactivate accounts.",
      },
    ],
    articleIds: ["admin-users"],
    guideIds: ["guide-admin-users"],
  },
  {
    routePattern: "/admin/institutions",
    title: "Institutions",
    summary: "Maintain the institutions applicants belong to.",
    blocks: [
      {
        type: "paragraph",
        text: "Add, edit, or deactivate institutions. Applicants choose from this list when completing their profile.",
      },
    ],
    articleIds: ["admin-institutions-categories"],
    guideIds: ["guide-admin-institutions"],
  },
  {
    routePattern: "/admin/categories",
    title: "Categories",
    summary: "Maintain public-office categories and their article references.",
    blocks: [
      {
        type: "paragraph",
        text: "Add or edit public-office categories, each with its Article 286(5) reference.",
      },
    ],
    articleIds: ["admin-institutions-categories"],
    guideIds: ["guide-admin-institutions"],
  },
  {
    routePattern: "/admin/audit-logs",
    title: "Audit logs",
    summary: "The immutable record of every action.",
    blocks: [
      {
        type: "paragraph",
        text: "Audit logs record every state-changing action. They cannot be edited or deleted. Filter by action, entity, date, or user.",
      },
    ],
    articleIds: ["admin-audit-reports"],
  },
  {
    routePattern: "/admin/reports",
    title: "Reports",
    summary: "System reports on declarations, users, and processing.",
    blocks: [
      {
        type: "paragraph",
        text: "Reports summarise declarations by status and month, users by role, top institutions, and processing times.",
      },
    ],
    articleIds: ["admin-audit-reports"],
  },
];
