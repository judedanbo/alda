import type { HelpGuide } from "../types";

export const officerGuides: HelpGuide[] = [
  {
    id: "guide-officer-form-collection",
    title: "Record a form collection",
    description: "Log that an applicant has collected their physical form.",
    roles: ["schedule_officer"],
    category: "form-handling",
    estimatedMinutes: 3,
    steps: [
      {
        title: "Find the declaration",
        detail:
          "On the Form Collections page, locate the declaration by its unique code. It must be at the Code Generated stage.",
      },
      {
        title: "Choose the collection office",
        detail:
          "Select the collection office the physical form was handed out from.",
      },
      {
        title: "Record the collection",
        detail:
          "Confirm the collection date and add any notes. Saving moves the declaration to Form Collected and notifies the applicant.",
      },
    ],
  },
  {
    id: "guide-officer-form-return",
    title: "Record a form return",
    description: "Log that a completed form has been returned by the applicant.",
    roles: ["schedule_officer"],
    category: "form-handling",
    estimatedMinutes: 3,
    steps: [
      {
        title: "Open Form Returns",
        detail:
          "On the Form Returns page, find the declaration. It must be at the Form Collected stage.",
      },
      {
        title: "Record where it was returned",
        detail:
          "Select the office the form was returned to and add any notes.",
      },
      {
        title: "Confirm the return",
        detail:
          "Saving moves the declaration to Submitted, ready for review, and notifies the applicant.",
      },
    ],
  },
  {
    id: "guide-officer-review",
    title: "Review a declaration",
    description: "Work through the eight sections and reach a decision.",
    roles: ["schedule_officer"],
    category: "reviews",
    estimatedMinutes: 15,
    relatedTourId: "tour-officer-review",
    steps: [
      {
        title: "Open the declaration for review",
        detail:
          "On the Reviews page, select a declaration that is Submitted or Under Review.",
      },
      {
        title: "Review each section",
        detail:
          "Go through all eight sections. Mark each one acceptable, or flag it with a comment explaining what needs attention.",
      },
      {
        title: "Submit your section reviews",
        detail:
          "If you flag any section, the declaration stays Under Review and the applicant is notified of the issues to fix.",
        note: {
          variant: "info",
          text: "When a flagged section is corrected, mark it resolved so the declaration can proceed.",
        },
      },
      {
        title: "Approve or reject",
        detail:
          "Once every section is acceptable and all flagged issues are resolved, approve the declaration. To reject it, give a clear reason — a new code is issued to the applicant automatically.",
      },
    ],
  },
  {
    id: "guide-officer-receipt",
    title: "Generate a receipt",
    description: "Produce the sealed receipt for an approved declaration.",
    roles: ["schedule_officer"],
    category: "reviews",
    estimatedMinutes: 2,
    steps: [
      {
        title: "Open Receipts",
        detail:
          "On the Receipts page, find an Approved declaration awaiting a receipt.",
      },
      {
        title: "Generate the receipt",
        detail:
          "Generate the receipt. The portal produces a PDF with a receipt number and seal number.",
      },
      {
        title: "Declaration sealed",
        detail:
          "The declaration moves to Sealed — its final status — and the applicant is notified that the receipt is ready.",
      },
    ],
  },
];
