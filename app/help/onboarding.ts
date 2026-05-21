import type { HelpRole, OnboardingChecklist } from "./types";

// First-login getting-started checklist per role. Rendered by
// OnboardingChecklist.vue on the dashboard; evaluated by useOnboarding().
export const onboardingChecklists: Record<HelpRole, OnboardingChecklist> = {
  applicant: {
    role: "applicant",
    title: "Getting started",
    description: "Complete these steps to create your first declaration.",
    items: [
      {
        id: "verify-email",
        label: "Verify your email address",
        description: "Click the verification link we sent to your inbox.",
        completion: "auto",
        completionKey: "emailVerified",
      },
      {
        id: "complete-profile",
        label: "Complete your profile",
        description:
          "Add your personal details, Ghana Card images, and office details.",
        completion: "auto",
        completionKey: "profileCreated",
        actionTo: "/applicant/profile/setup",
        actionLabel: "Complete profile",
      },
      {
        id: "get-verified",
        label: "Get your registration verified",
        description:
          "The Legal Unit reviews your profile. You will be notified of the outcome.",
        completion: "auto",
        completionKey: "profileVerified",
      },
      {
        id: "take-tour",
        label: "Take the quick tour",
        description: "A short walkthrough of your dashboard and navigation.",
        completion: "action",
        actionTourId: "tour-applicant-getting-started",
        actionLabel: "Start tour",
      },
      {
        id: "create-declaration",
        label: "Create your first declaration",
        description: "Generate a unique code to begin declaring your assets.",
        completion: "auto",
        completionKey: "hasActiveDeclaration",
        actionTo: "/applicant/declaration/new",
        actionLabel: "New declaration",
      },
    ],
  },
  schedule_officer: {
    role: "schedule_officer",
    title: "Getting started",
    description: "Get familiar with the Schedule Officer workflow.",
    items: [
      {
        id: "take-tour",
        label: "Take the review workflow tour",
        description: "A short walkthrough of the officer queues and reviews.",
        completion: "action",
        actionTourId: "tour-officer-review",
        actionLabel: "Start tour",
      },
      {
        id: "read-workflow",
        label: "Read the officer workflow guide",
        description: "Understand each step from form collection to receipt.",
        completion: "action",
        actionTo: "/help/guides/guide-officer-review",
        actionLabel: "Open guide",
      },
      {
        id: "visit-reviews",
        label: "Open the Reviews page",
        description: "See declarations waiting to be reviewed.",
        completion: "action",
        actionTo: "/officer/reviews",
        actionLabel: "Go to Reviews",
      },
      {
        id: "explore-dashboard",
        label: "Explore your dashboard queues",
        description: "Each queue shows what needs action next.",
        completion: "manual",
      },
    ],
  },
  legal_unit: {
    role: "legal_unit",
    title: "Getting started",
    description: "Get familiar with the Legal Unit workflow.",
    items: [
      {
        id: "take-tour",
        label: "Take the verification workflow tour",
        description: "A short walkthrough of the Legal Unit areas.",
        completion: "action",
        actionTourId: "tour-legal-verification",
        actionLabel: "Start tour",
      },
      {
        id: "visit-verifications",
        label: "Open the Applicant Verifications page",
        description: "See registrations awaiting verification.",
        completion: "action",
        actionTo: "/legal/verifications",
        actionLabel: "Go to Verifications",
      },
      {
        id: "read-reissue",
        label: "Read the lost-form reissue guide",
        description: "Learn how to record an offline reissue approval.",
        completion: "action",
        actionTo: "/help/guides/guide-legal-reissue",
        actionLabel: "Open guide",
      },
    ],
  },
  admin: {
    role: "admin",
    title: "Getting started",
    description: "Get familiar with the administration areas.",
    items: [
      {
        id: "take-tour",
        label: "Take the portal overview tour",
        description: "A short walkthrough of the administration areas.",
        completion: "action",
        actionTourId: "tour-admin-overview",
        actionLabel: "Start tour",
      },
      {
        id: "visit-users",
        label: "Open the Users page",
        description: "Review accounts and roles.",
        completion: "action",
        actionTo: "/admin/users",
        actionLabel: "Go to Users",
      },
      {
        id: "read-audit",
        label: "Read about audit logs and reports",
        description: "Understand the compliance record and reporting.",
        completion: "action",
        actionTo: "/help/articles/admin-audit-reports",
        actionLabel: "Open article",
      },
    ],
  },
};
