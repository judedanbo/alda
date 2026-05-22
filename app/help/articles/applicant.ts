import type { HelpArticle } from "../types";

export const applicantArticles: HelpArticle[] = [
  {
    id: "applicant-getting-started",
    title: "Getting started as an applicant",
    summary:
      "The full path from registration to your first declaration code.",
    roles: ["applicant"],
    category: "getting-started",
    keywords: ["start", "register", "first declaration", "overview"],
    relatedGuideIds: ["guide-applicant-register", "guide-applicant-profile"],
    body: [
      {
        type: "paragraph",
        text: "As an applicant you complete a few one-time setup steps, then you can create a declaration whenever you need one.",
      },
      {
        type: "heading",
        text: "The setup steps",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Register with your email and create a password.",
          "Verify your email by clicking the link we send you.",
          "Complete your profile — personal details, Ghana Card images, and your office.",
          "Wait for the Legal Unit to verify your registration.",
          "Once verified, create a declaration to receive your unique code.",
        ],
      },
      {
        type: "note",
        variant: "info",
        text: "You only complete registration, profile setup, and verification once. After that, creating a declaration is a single step.",
      },
      {
        type: "steps",
        guideId: "guide-applicant-register",
      },
    ],
  },
  {
    id: "applicant-profile",
    title: "Completing your profile",
    summary:
      "What goes into the three-step profile: personal details, Ghana Card, and office.",
    roles: ["applicant"],
    category: "getting-started",
    keywords: ["profile", "ghana card", "office", "designation", "institution"],
    relatedGuideIds: ["guide-applicant-profile"],
    relatedArticleIds: ["applicant-getting-started"],
    body: [
      {
        type: "paragraph",
        text: "Your profile is completed in three steps. The Legal Unit uses it to verify that you are a public officer covered by Article 286(5).",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Personal details — your full name and contact information.",
          "Ghana Card — clear photographs of the front and back of your card.",
          "Office details — your designation, category, institution, and dates.",
        ],
      },
      {
        type: "note",
        variant: "warning",
        text: "Ghana Card images must be sharp and fully readable. Blurred or cropped images are the most common reason a registration is placed On Hold or sent back for More Information.",
      },
      {
        type: "paragraph",
        text: "You can update your profile from the Profile page until your registration is verified.",
      },
    ],
  },
  {
    id: "applicant-verification",
    title: "Registration verification",
    summary:
      "What the Legal Unit decision means and what to do for each outcome.",
    roles: ["applicant"],
    category: "verification",
    keywords: [
      "verification",
      "verified",
      "on hold",
      "more info",
      "rejected",
      "legal unit",
    ],
    body: [
      {
        type: "paragraph",
        text: "After you complete your profile, the Legal Unit reviews your registration. You receive a notification with the decision.",
      },
      {
        type: "list",
        items: [
          "Verified — you can now create declarations.",
          "On Hold — your registration is paused; the message explains why.",
          "More Information Required — update your profile with what was asked for.",
          "Rejected — the registration cannot proceed; read the reason carefully.",
        ],
      },
      {
        type: "note",
        variant: "info",
        text: "The New Declaration option stays disabled until your registration is Verified.",
      },
    ],
  },
  {
    id: "applicant-declarations",
    title: "Creating and tracking a declaration",
    summary:
      "How to create a declaration, read its status timeline, and the one-active-declaration rule.",
    roles: ["applicant"],
    category: "declarations",
    keywords: ["declaration", "code", "unique code", "status", "timeline"],
    relatedGuideIds: ["guide-applicant-new-declaration"],
    relatedArticleIds: ["applicant-reissue"],
    body: [
      {
        type: "paragraph",
        text: "Creating a declaration generates a unique code. You take that code to the Audit Service to collect your physical form; everything after that is recorded by officers.",
      },
      {
        type: "heading",
        text: "One active declaration at a time",
      },
      {
        type: "paragraph",
        text: "You cannot start a new declaration while one is already in progress (Code Generated, Form Collected, Submitted, or Under Review). Finish or resolve the current one first.",
      },
      {
        type: "heading",
        text: "Following progress",
      },
      {
        type: "paragraph",
        text: "Open any declaration to see its status timeline — every stage from Code Generated through to Sealed, with the dates each step happened.",
      },
      {
        type: "note",
        variant: "warning",
        text: "If a declaration is rejected during review, the portal automatically issues a new code so you can start a fresh declaration.",
      },
    ],
  },
  {
    id: "applicant-reissue",
    title: "Requesting a lost-form reissue",
    summary:
      "What to do if you lose the physical form after it has been collected.",
    roles: ["applicant"],
    category: "form-handling",
    keywords: ["lost form", "reissue", "auditor general", "regional auditor"],
    relatedGuideIds: ["guide-applicant-reissue"],
    body: [
      {
        type: "paragraph",
        text: "If you lose your physical declaration form after it has been collected, you can request a reissue from the declaration's detail page. This is only available while the declaration is at the Form Collected stage.",
      },
      {
        type: "heading",
        text: "How it works",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Submit a reissue request from the declaration page.",
          "Take an offline letter to the Auditor General or a Regional Auditor for approval.",
          "Bring the approved letter to the Legal Unit, who records the decision and reissues the form.",
          "Return the reissued form through the normal form-return step.",
        ],
      },
      {
        type: "note",
        variant: "info",
        text: "Your declaration stays at the Form Collected stage throughout the reissue process — its status does not change.",
      },
    ],
  },
];
