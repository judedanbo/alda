import type { HelpArticle } from "../types";

export const officerArticles: HelpArticle[] = [
  {
    id: "officer-getting-started",
    title: "The Schedule Officer workflow",
    summary:
      "An overview of every step an officer drives, from form collection to receipt.",
    roles: ["schedule_officer"],
    category: "getting-started",
    keywords: ["overview", "workflow", "officer", "schedule officer"],
    body: [
      {
        type: "paragraph",
        text: "Once an applicant has a code, the Schedule Officer drives the rest of the declaration. Each step changes the declaration's status.",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Record form collection — the applicant collects the physical form (Code Generated to Form Collected).",
          "Record form return — the filled form comes back (Form Collected to Submitted).",
          "Review the declaration section by section (Submitted to Under Review).",
          "Approve or reject the declaration (Under Review to Approved or Rejected).",
          "Generate the receipt (Approved to Sealed).",
        ],
      },
      {
        type: "note",
        variant: "tip",
        text: "Your dashboard shows a queue for each step so you always know what needs action next.",
      },
    ],
  },
  {
    id: "officer-form-handling",
    title: "Recording form collection and return",
    summary:
      "How to record that a form was collected, and later that the filled form was returned.",
    roles: ["schedule_officer"],
    category: "form-handling",
    keywords: ["form collection", "form return", "collection office"],
    relatedGuideIds: ["guide-officer-form-collection", "guide-officer-form-return"],
    body: [
      {
        type: "heading",
        text: "Form collection",
      },
      {
        type: "paragraph",
        text: "When an applicant collects their physical form, find the declaration by its code and record the collection. You choose the collection office the form was handed out from. This moves the declaration to Form Collected.",
      },
      {
        type: "heading",
        text: "Form return",
      },
      {
        type: "paragraph",
        text: "When the applicant brings the completed form back, record the return. This moves the declaration to Submitted and makes it ready for review.",
      },
      {
        type: "note",
        variant: "info",
        text: "A declaration must be at Form Collected before you can record a return.",
      },
      {
        type: "note",
        variant: "warning",
        text: "You can only act on declarations belonging to the collection office(s) you are assigned to. Acting on another office's declaration is refused with \"You are not assigned to this collection office.\" Ask an administrator to assign you to the right office.",
      },
    ],
  },
  {
    id: "officer-reviews",
    title: "Reviewing a declaration",
    summary:
      "The eight-section review, flagging issues, resolving them, and final approval.",
    roles: ["schedule_officer"],
    category: "reviews",
    keywords: ["review", "sections", "approve", "reject", "comments"],
    relatedGuideIds: ["guide-officer-review"],
    relatedArticleIds: ["officer-receipts"],
    body: [
      {
        type: "paragraph",
        text: "A returned declaration is reviewed one section at a time. The form has eight sections, each covering a different part of the declaration.",
      },
      {
        type: "list",
        items: [
          "Mark a section acceptable if it is complete and correct.",
          "Flag a section with a comment if something needs attention — the applicant is notified.",
        ],
      },
      {
        type: "heading",
        text: "From review to a decision",
      },
      {
        type: "paragraph",
        text: "If every section is acceptable, the declaration can be approved. If you flag issues, the declaration stays Under Review until each flagged section is resolved. Once all issues are resolved you can give final approval, or reject the declaration with a reason.",
      },
      {
        type: "note",
        variant: "warning",
        text: "Rejecting a declaration automatically issues a new code to the applicant so they can start a fresh declaration.",
      },
    ],
  },
  {
    id: "officer-receipts",
    title: "Generating receipts",
    summary: "How to produce the sealed receipt for an approved declaration.",
    roles: ["schedule_officer"],
    category: "reviews",
    keywords: ["receipt", "seal", "sealed", "pdf"],
    relatedGuideIds: ["guide-officer-receipt"],
    body: [
      {
        type: "paragraph",
        text: "Once a declaration is Approved, generate its receipt. This produces a PDF receipt with a seal number and moves the declaration to its final Sealed status.",
      },
      {
        type: "note",
        variant: "info",
        text: "The applicant is notified automatically when their receipt is ready.",
      },
    ],
  },
  {
    id: "officer-verify",
    title: "Verifying a declaration code",
    summary: "Looking up a declaration by its unique code.",
    roles: ["schedule_officer"],
    category: "verification",
    keywords: ["verify", "code", "lookup", "search"],
    body: [
      {
        type: "paragraph",
        text: "You can look up any declaration by its unique code to see the applicant's details, the current status, the review history, and the receipt if one exists. Use the quick lookup on your dashboard.",
      },
    ],
  },
];
