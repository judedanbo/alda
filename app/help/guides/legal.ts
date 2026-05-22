import type { HelpGuide } from "../types";

export const legalGuides: HelpGuide[] = [
  {
    id: "guide-legal-verification",
    title: "Verify an applicant registration",
    description: "Review a registration and record a verification decision.",
    roles: ["legal_unit"],
    category: "verification",
    estimatedMinutes: 8,
    relatedTourId: "tour-legal-verification",
    steps: [
      {
        title: "Open the verification queue",
        detail:
          "On the Applicant Verifications page, the queue defaults to registrations awaiting verification.",
      },
      {
        title: "Review the registration",
        detail:
          "Open a registration and check the personal details, Ghana Card images, and office information.",
      },
      {
        title: "Choose a decision",
        detail:
          "Select Verified, On Hold, More Information Required, or Rejected, and enter a clear reason.",
        note: {
          variant: "info",
          text: "You can add an optional message to the applicant alongside the reason.",
        },
      },
      {
        title: "Submit the decision",
        detail:
          "The applicant is notified of the outcome. A verified applicant can now create declarations.",
      },
    ],
  },
  {
    id: "guide-legal-reissue",
    title: "Process a lost-form reissue",
    description: "Record an offline approval to reissue a lost form.",
    roles: ["legal_unit"],
    category: "form-handling",
    estimatedMinutes: 6,
    steps: [
      {
        title: "Open the reissue request",
        detail:
          "On the Form Reissues page, open a request with the Pending status.",
      },
      {
        title: "Upload the approved letter",
        detail:
          "Upload the scanned letter approved by the Auditor General or a Regional Auditor.",
      },
      {
        title: "Select the approver",
        detail:
          "Choose whether the approval came from the Auditor General or a Regional Auditor, and add their details.",
      },
      {
        title: "Record the decision",
        detail:
          "Record the decision as Approved or Declined, with any reasons. An approved reissue keeps the declaration at Form Collected — the applicant returns the new form normally.",
      },
    ],
  },
];
