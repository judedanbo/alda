import type { TourDefinition } from "./types";

// Interactive tours. Each step's `element` is a [data-tour="..."] selector.
// The implementer must keep these data-tour attributes present on the matching
// elements:
//
//   nav-dashboard, nav-declarations, nav-new-declaration, nav-analytics,
//   nav-form-returns, nav-reviews, nav-receipts, nav-verifications,
//   nav-form-reissues, nav-verify-code, nav-users, nav-institutions,
//   nav-categories, nav-audit-logs, nav-web-analytics, nav-reports, nav-help
//        -> the per-role navigation links in layouts/dashboard.vue
//   help-button   -> the global "?" button in the dashboard header
//   onboarding    -> the OnboardingChecklist card on dashboards
//   new-declaration-form -> the main card on pages/applicant/declaration/new.vue
//   profile-progress, profile-personal, profile-continue
//        -> pages/applicant/profile/setup.vue
//   declaration-code, declaration-timeline, declaration-review-comments,
//   declaration-receipt, declaration-reissue
//        -> pages/applicant/declaration/[id].vue
//   analytics-stats, analytics-filters, analytics-kpis, analytics-timeline,
//   analytics-table
//        -> pages/applicant/analytics.vue
//
// useTour skips any step whose target element is not on the page, so a missing
// optional target (e.g. a dismissed onboarding card) degrades gracefully.
export const tours: TourDefinition[] = [
  {
    id: "tour-applicant-getting-started",
    title: "Applicant: getting started",
    description: "A quick orientation tour of your dashboard and navigation.",
    roles: ["applicant"],
    route: "/applicant/dashboard",
    steps: [
      {
        title: "Welcome to the portal",
        description:
          "This short tour shows you around. You can stop it at any time and restart it from the help centre.",
      },
      {
        element: "[data-tour=\"nav-dashboard\"]",
        title: "Your dashboard",
        description:
          "Your dashboard is home base — it shows your declarations and what to do next.",
      },
      {
        element: "[data-tour=\"onboarding\"]",
        title: "Onboarding checklist",
        description:
          "Work through this checklist to reach your first declaration. Each item links to where you need to go.",
      },
      {
        element: "[data-tour=\"nav-new-declaration\"]",
        title: "New declaration",
        description:
          "Once your email and phone are verified and the Legal Unit has verified your registration, create a declaration here to get your unique code.",
      },
      {
        element: "[data-tour=\"help-button\"]",
        title: "Help is always here",
        description:
          "The question-mark button explains whichever page you are on. The Help link opens the full help centre.",
      },
      {
        title: "You are ready",
        description:
          "That is the tour. Complete your profile and you will be on your way.",
      },
    ],
  },
  {
    id: "tour-applicant-new-declaration",
    title: "Applicant: create a declaration",
    description: "Walk through creating a new declaration.",
    roles: ["applicant"],
    route: "/applicant/declaration/new",
    steps: [
      {
        title: "Creating a declaration",
        description:
          "Creating a declaration generates a unique code you take to the Audit Service.",
      },
      {
        element: "[data-tour=\"new-declaration-form\"]",
        title: "Start here",
        description:
          "Review the details on this page and create your declaration. Remember — only one declaration can be active at a time.",
      },
      {
        title: "Save your code",
        description:
          "After creating the declaration, copy the unique code. You will also receive it by email.",
      },
    ],
  },
  {
    id: "tour-applicant-profile-setup",
    title: "Applicant: complete your profile",
    description: "Walk through the three-step profile setup.",
    roles: ["applicant"],
    route: "/applicant/profile/setup",
    steps: [
      {
        title: "Completing your profile",
        description:
          "Your profile has three steps. The Legal Unit reviews it to verify your registration before you can declare assets.",
      },
      {
        element: "[data-tour=\"profile-progress\"]",
        title: "Track your progress",
        description:
          "This bar shows which of the three steps you are on. You can move back at any time.",
      },
      {
        element: "[data-tour=\"profile-personal\"]",
        title: "Step 1 — Personal details",
        description:
          "Enter your full name and Ghana Card number exactly as they appear on the card.",
      },
      {
        title: "Step 2 — Ghana Card images",
        description:
          "Next you upload a photo of your Ghana Card. Blurred or cropped images are the most common cause of verification delays — use sharp, well-lit shots.",
      },
      {
        title: "Step 3 — Office details",
        description:
          "Finally, add at least one public office you hold or have held. You can add several.",
      },
      {
        element: "[data-tour=\"profile-continue\"]",
        title: "Move through the steps",
        description:
          "Use this button to advance. On the last step it submits your profile for verification.",
      },
      {
        title: "That is the profile tour",
        description:
          "Once submitted, the Legal Unit reviews your registration and you will be notified of the outcome.",
      },
    ],
  },
  {
    id: "tour-applicant-declaration-detail",
    title: "Applicant: track a declaration",
    description: "Find your way around the declaration detail page.",
    roles: ["applicant"],
    steps: [
      {
        title: "Your declaration at a glance",
        description:
          "This page shows everything about one declaration — its code, its progress, and any actions you need to take.",
      },
      {
        element: "[data-tour=\"declaration-code\"]",
        title: "Declaration code",
        description:
          "This is the unique code for the declaration. Officers and the Legal Unit use it to find your record.",
      },
      {
        element: "[data-tour=\"declaration-timeline\"]",
        title: "Status timeline",
        description:
          "Follow each step here as officers record it — from form collection through to the sealed receipt.",
      },
      {
        element: "[data-tour=\"declaration-review-comments\"]",
        title: "Review comments",
        description:
          "If a reviewer flags a section, it appears here. Address these points before your next visit to the Audit Service.",
      },
      {
        element: "[data-tour=\"declaration-receipt\"]",
        title: "Your receipt",
        description:
          "Once the declaration is sealed, view or download your receipt PDF from here.",
      },
      {
        element: "[data-tour=\"declaration-reissue\"]",
        title: "Lost your form?",
        description:
          "While the form is collected, you can start a lost-form reissue request from this link.",
      },
      {
        title: "That is the tour",
        description:
          "Open any declaration from My Declarations to track it the same way.",
      },
    ],
  },
  {
    id: "tour-applicant-reissue",
    title: "Applicant: request a lost-form reissue",
    description: "What to do when you lose a collected declaration form.",
    roles: ["applicant"],
    steps: [
      {
        title: "When you lose a collected form",
        description:
          "If you lose your physical form while the declaration is at the Form Collected stage, you can request a reissue.",
      },
      {
        element: "[data-tour=\"declaration-reissue\"]",
        title: "Start the request",
        description:
          "Open the reissue request from this link on the declaration detail page. It records a tracked request and notifies the Legal Unit.",
      },
      {
        title: "Get the offline approval",
        description:
          "Take a letter explaining how the form was lost to the Auditor General or a Regional Auditor, and obtain their approval.",
      },
      {
        title: "Bring the letter to the Legal Unit",
        description:
          "The Legal Unit records the approval and reissues your form. The declaration stays at Form Collected — return the new form through the normal process.",
      },
    ],
  },
  {
    id: "tour-applicant-analytics",
    title: "Applicant: your analytics",
    description: "An orientation tour of your sealed-declaration insights.",
    roles: ["applicant"],
    route: "/applicant/analytics",
    steps: [
      {
        title: "Your declaration analytics",
        description:
          "This page summarises your sealed declarations.",
      },
      {
        element: "[data-tour=\"analytics-stats\"]",
        title: "Totals at a glance",
        description: "A quick count of your declarations by status.",
      },
      {
        element: "[data-tour=\"analytics-filters\"]",
        title: "Filter the view",
        description:
          "Narrow everything below by date range and other criteria.",
      },
      {
        element: "[data-tour=\"analytics-kpis\"]",
        title: "Key metrics",
        description:
          "Headline figures for your sealed declarations, including processing times.",
      },
      {
        element: "[data-tour=\"analytics-timeline\"]",
        title: "Sealed over time",
        description:
          "How your sealed declarations are distributed across months.",
      },
      {
        element: "[data-tour=\"analytics-table\"]",
        title: "Your declarations",
        description:
          "Sort and page through your sealed declarations in detail.",
      },
      {
        title: "That is the tour",
        description: "The help centre has more on reading these figures.",
      },
    ],
  },
  {
    id: "tour-officer-review",
    title: "Officer: review workflow",
    description: "An orientation tour of the officer review queues.",
    roles: ["schedule_officer"],
    route: "/officer/reviews",
    steps: [
      {
        title: "The review workflow",
        description:
          "As a Schedule Officer you drive a declaration from form collection through to its sealed receipt.",
      },
      {
        element: "[data-tour=\"nav-reviews\"]",
        title: "Reviews",
        description:
          "Review declarations here, section by section — eight sections in all.",
      },
      {
        title: "Sections and decisions",
        description:
          "Mark each section acceptable or flag it with a comment. When every section is acceptable you can approve the declaration; otherwise you can reject it with a reason.",
      },
      {
        element: "[data-tour=\"nav-receipts\"]",
        title: "Receipts",
        description:
          "After approval, generate the receipt here to seal the declaration.",
      },
      {
        element: "[data-tour=\"help-button\"]",
        title: "Help is always here",
        description:
          "Use the question-mark button for guidance on whichever page you are on.",
      },
      {
        title: "You are ready",
        description: "That is the tour. The help centre has the full details.",
      },
    ],
  },
  {
    id: "tour-legal-verification",
    title: "Legal Unit: verification workflow",
    description: "An orientation tour of the Legal Unit areas.",
    roles: ["legal_unit"],
    route: "/legal/verifications",
    steps: [
      {
        title: "The Legal Unit workflow",
        description:
          "You verify applicant registrations, verify declaration codes, and process lost-form reissues.",
      },
      {
        element: "[data-tour=\"nav-verifications\"]",
        title: "Applicant verifications",
        description:
          "Review registrations here and decide Verified, On Hold, More Information Required, or Rejected.",
      },
      {
        element: "[data-tour=\"nav-verify-code\"]",
        title: "Verify a code",
        description:
          "Confirm a declaration's authenticity by entering its unique code.",
      },
      {
        element: "[data-tour=\"nav-form-reissues\"]",
        title: "Form reissues",
        description:
          "Process lost-form reissue requests by recording the offline approval.",
      },
      {
        title: "You are ready",
        description: "That is the tour. The help centre has the full details.",
      },
    ],
  },
  {
    id: "tour-admin-overview",
    title: "Administrator: portal overview",
    description: "An orientation tour of the administration areas.",
    roles: ["admin"],
    route: "/admin/dashboard",
    steps: [
      {
        title: "Administering the portal",
        description:
          "You manage users, reference data, and the compliance record across the whole portal.",
      },
      {
        element: "[data-tour=\"nav-users\"]",
        title: "Users",
        description:
          "Create accounts, assign roles, and activate or deactivate users.",
      },
      {
        element: "[data-tour=\"nav-audit-logs\"]",
        title: "Audit logs",
        description:
          "Review the immutable record of every action taken in the portal.",
      },
      {
        element: "[data-tour=\"help-button\"]",
        title: "Help is always here",
        description:
          "Use the question-mark button for guidance on whichever page you are on.",
      },
      {
        title: "You are ready",
        description: "That is the tour. The help centre has the full details.",
      },
    ],
  },
];
