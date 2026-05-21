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
          "Once your registration is verified, create a declaration here to get your unique code.",
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
