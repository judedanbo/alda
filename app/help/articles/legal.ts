import type { HelpArticle } from "../types";

export const legalArticles: HelpArticle[] = [
  {
    id: "legal-getting-started",
    title: "The Legal Unit workflow",
    summary:
      "An overview of registration verification, code verification, and reissues.",
    roles: ["legal_unit"],
    category: "getting-started",
    keywords: ["overview", "legal unit", "workflow"],
    body: [
      {
        type: "paragraph",
        text: "The Legal Unit has three responsibilities in the portal.",
      },
      {
        type: "list",
        items: [
          "Verify applicant registrations so applicants can create declarations.",
          "Verify a declaration's authenticity using its unique code.",
          "Process lost-form reissue requests.",
        ],
      },
      {
        type: "note",
        variant: "tip",
        text: "Your dashboard summarises pending verifications and reissue requests so you can see what needs attention.",
      },
    ],
  },
  {
    id: "legal-verifications",
    title: "Verifying applicant registrations",
    summary:
      "Reviewing a registration and choosing Verified, On Hold, More Info, or Rejected.",
    roles: ["legal_unit"],
    category: "verification",
    keywords: [
      "verification",
      "applicant",
      "verified",
      "on hold",
      "more info",
      "rejected",
    ],
    relatedGuideIds: ["guide-legal-verification"],
    body: [
      {
        type: "paragraph",
        text: "When an applicant completes their profile, their registration appears in your verification queue. Open it to review their personal details, Ghana Card images, and office information.",
      },
      {
        type: "heading",
        text: "The four decisions",
      },
      {
        type: "list",
        items: [
          "Verified — the applicant can now create declarations.",
          "On Hold — pause the registration; the applicant sees your reason.",
          "More Information Required — ask the applicant to update specific details.",
          "Rejected — the registration cannot proceed.",
        ],
      },
      {
        type: "note",
        variant: "info",
        text: "Always give a clear reason. The applicant receives your reason and optional message with the decision.",
      },
    ],
  },
  {
    id: "legal-verify-code",
    title: "Verifying a declaration code",
    summary: "Confirming a declaration's authenticity from its unique code.",
    roles: ["legal_unit"],
    category: "verification",
    keywords: ["verify code", "authenticity", "lookup"],
    body: [
      {
        type: "paragraph",
        text: "The Verify Code page lets you confirm a declaration is genuine. Enter the unique code to see the applicant, the declaration's status and timeline, any review comments, and the receipt if it has been sealed.",
      },
    ],
  },
  {
    id: "legal-reissues",
    title: "Processing lost-form reissues",
    summary:
      "Recording an offline Auditor General or Regional Auditor approval to reissue a form.",
    roles: ["legal_unit"],
    category: "form-handling",
    keywords: [
      "reissue",
      "lost form",
      "auditor general",
      "regional auditor",
      "letter",
    ],
    relatedGuideIds: ["guide-legal-reissue"],
    body: [
      {
        type: "paragraph",
        text: "When an applicant loses a collected form, they submit a reissue request and obtain an offline approval letter from the Auditor General or a Regional Auditor. You record that decision in one combined action.",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Open the pending reissue request.",
          "Upload the scanned approved letter.",
          "Select the approver — Auditor General or Regional Auditor.",
          "Record the decision — Approved or Declined — with any reasons.",
        ],
      },
      {
        type: "note",
        variant: "info",
        text: "An approved reissue does not change the declaration's status — it stays at Form Collected. The applicant then returns the reissued form through the normal form-return step.",
      },
    ],
  },
];
