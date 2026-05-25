import type { ContextualHelp } from "./types";

// Route-to-help mapping for the contextual "?" panel. Order does not matter —
// getContextualHelp() picks the most specific match. Patterns support ":param"
// segments and a trailing "/*" wildcard.
export const contextualHelp: ContextualHelp[] = [
  // --- Auth (unauthenticated) ---------------------------------------------
  {
    routePattern: "/auth/login",
    title: "Sign in",
    summary: "Use the email and password you registered with.",
    blocks: [
      {
        type: "paragraph",
        text: "Sign in with the email address you registered. If you have forgotten your password, use the 'Forgot password?' link to receive a reset email.",
      },
      {
        type: "note",
        variant: "info",
        text: "Repeated failed sign-ins from the same network may be rate-limited for a short time.",
      },
      { type: "link", label: "Can't sign in? Contact support", to: "/contact" },
    ],
    articleIds: ["common-account", "common-welcome", "applicant-getting-started"],
    guideIds: ["guide-applicant-register"],
  },
  {
    routePattern: "/auth/register",
    title: "Create your account",
    summary: "Register with the email and phone the Legal Unit will use to identify you.",
    blocks: [
      {
        type: "paragraph",
        text: "Use an email address and phone number you control — the Legal Unit verifies your registration against the details you enter here.",
      },
      {
        type: "list",
        items: [
          "Phone must be in Ghana international format, starting with +233.",
          "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a digit.",
          "You must accept the terms of service to continue.",
        ],
      },
      {
        type: "paragraph",
        text: "After you submit, we send a verification email. Once you verify your email and sign in, you complete your profile (personal details, Ghana Card, office), which the Legal Unit then reviews before you can create a declaration.",
      },
      {
        type: "note",
        variant: "warning",
        text: "Use your real legal name on your profile — it must match your Ghana Card. The Legal Unit rejects registrations where these do not match.",
      },
      { type: "link", label: "Need help registering? Contact support", to: "/contact" },
    ],
    articleIds: [
      "applicant-getting-started",
      "common-account",
      "applicant-profile",
      "applicant-verification",
    ],
    guideIds: ["guide-applicant-register", "guide-applicant-profile"],
  },
  {
    routePattern: "/auth/forgot-password",
    title: "Forgot your password",
    summary: "We will email you a single-use reset link.",
    blocks: [
      {
        type: "paragraph",
        text: "Enter the email address you registered with. If an account exists for that address, we send a password reset link to it.",
      },
      {
        type: "note",
        variant: "tip",
        text: "Reset links expire after a short time. If your link no longer works, request a new one from this page.",
      },
      {
        type: "paragraph",
        text: "If no email arrives after a few minutes, check your spam folder. Still nothing? Contact support so we can confirm the address on file.",
      },
      { type: "link", label: "Contact support", to: "/contact" },
    ],
    articleIds: ["common-account"],
    guideIds: ["guide-applicant-register"],
  },
  {
    routePattern: "/auth/reset-password",
    title: "Set a new password",
    summary: "Choose a password that meets every requirement on the checklist.",
    blocks: [
      {
        type: "paragraph",
        text: "Your new password must satisfy every item on the strength checklist — at least 8 characters, an uppercase letter, a lowercase letter, and a digit. Both fields must match before you can submit.",
      },
      {
        type: "note",
        variant: "info",
        text: "Reset links are single-use. After you set a new password, the link cannot be reused — request a fresh one if you need to reset again.",
      },
      { type: "link", label: "Link expired or not working? Contact support", to: "/contact" },
    ],
    articleIds: ["common-account"],
  },
  {
    routePattern: "/auth/verify-email",
    title: "Verify your email",
    summary: "We confirm your email address using the link we sent you.",
    blocks: [
      {
        type: "paragraph",
        text: "This page checks the verification token from the email link. Verification happens automatically — you do not need to enter anything.",
      },
      {
        type: "list",
        items: [
          "Loading: we are checking the token.",
          "Success: your email is verified — you can now sign in.",
          "Error: the link has expired or has already been used. Sign in to request a new verification email from your dashboard.",
        ],
      },
      { type: "link", label: "Still having trouble? Contact support", to: "/contact" },
    ],
    articleIds: ["common-account", "applicant-getting-started"],
    guideIds: ["guide-applicant-register"],
  },

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
    tourId: "tour-applicant-declaration-detail",
  },
  {
    routePattern: "/applicant/analytics",
    title: "Your analytics",
    summary: "Insights into your sealed and completed declarations.",
    blocks: [
      {
        type: "paragraph",
        text: "This page summarises your completed declarations — totals by status, key metrics, a timeline of sealed declarations, and a sortable table.",
      },
    ],
    articleIds: ["applicant-declarations"],
    tourId: "tour-applicant-analytics",
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
