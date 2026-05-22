import type { HelpGuide } from "../types";

export const adminGuides: HelpGuide[] = [
  {
    id: "guide-admin-users",
    title: "Create a user and assign roles",
    description: "Add a new account and give it the right access.",
    roles: ["admin"],
    category: "administration",
    estimatedMinutes: 5,
    relatedTourId: "tour-admin-overview",
    steps: [
      {
        title: "Open the Users page",
        detail:
          "Go to Users. You can search existing accounts or create a new one.",
      },
      {
        title: "Create the account",
        detail:
          "Enter the user's email and details and save the new account.",
      },
      {
        title: "Assign roles",
        detail:
          "Give the user one or more roles — applicant, schedule officer, legal unit, or admin. Roles control which areas of the portal they can reach.",
      },
      {
        title: "Set the account status",
        detail:
          "Make sure the account is active so the user can sign in. Deactivate an account at any time to block access without deleting records.",
      },
    ],
  },
  {
    id: "guide-admin-institutions",
    title: "Add an institution or category",
    description: "Maintain the reference data applicants choose from.",
    roles: ["admin"],
    category: "administration",
    estimatedMinutes: 4,
    steps: [
      {
        title: "Open Institutions or Categories",
        detail:
          "Choose the Institutions page to manage institutions, or the Categories page to manage public-office categories.",
      },
      {
        title: "Add the new entry",
        detail:
          "Create the institution, or create the category with its Article 286(5) reference.",
      },
      {
        title: "Keep the list current",
        detail:
          "Edit entries when details change, or deactivate ones no longer in use so applicants no longer see them.",
      },
    ],
  },
];
