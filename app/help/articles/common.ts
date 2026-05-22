import type { HelpArticle } from "../types";

// Articles that apply to every role (roles: []).
export const commonArticles: HelpArticle[] = [
  {
    id: "common-welcome",
    title: "About the Asset Declaration Portal",
    summary:
      "What the portal is for and how the four user types work together.",
    roles: [],
    category: "getting-started",
    keywords: ["overview", "introduction", "adla", "article 286"],
    body: [
      {
        type: "paragraph",
        text: "The Asset Declaration Portal (ADLA) supports Ghana's Article 286(5) compliance process. Public officers declare their assets, and the Ghana Audit Service records, reviews, and seals each declaration through a tracked workflow.",
      },
      {
        type: "heading",
        text: "Who does what",
      },
      {
        type: "list",
        items: [
          "Applicant — registers, completes a profile, and creates a declaration to receive a unique code.",
          "Schedule Officer — records form collection and return, reviews declarations, and issues receipts.",
          "Legal Unit — verifies applicant registrations, verifies declaration codes, and processes lost-form reissues.",
          "Administrator — manages users, institutions, categories, audit logs, and reports.",
        ],
      },
      {
        type: "note",
        variant: "info",
        text: "Every declaration moves through the same stages: Code Generated, Form Collected, Submitted, Under Review, Approved, then Sealed. A rejected declaration issues a fresh code so the applicant can start again.",
      },
      {
        type: "link",
        label: "See the full glossary of terms",
        to: "/help/glossary",
      },
    ],
  },
  {
    id: "common-account",
    title: "Signing in and account basics",
    summary: "How to sign in, reset a forgotten password, and verify your email.",
    roles: [],
    category: "account",
    keywords: ["login", "sign in", "password", "email verification", "logout"],
    body: [
      {
        type: "paragraph",
        text: "Your account is created when you register. Sign in from the login page with the email and password you registered with.",
      },
      {
        type: "heading",
        text: "Forgot your password?",
      },
      {
        type: "paragraph",
        text: "Use the \"Forgot password\" link on the login page. We send a reset link to your email; open it and choose a new password.",
      },
      {
        type: "heading",
        text: "Email verification",
      },
      {
        type: "paragraph",
        text: "After registering you receive a verification email. Click the link inside it to confirm your address. Applicants must verify their email before they can create a declaration.",
      },
      {
        type: "note",
        variant: "tip",
        text: "Use the account menu in the top-right corner to reach Settings or to log out.",
      },
    ],
  },
  {
    id: "common-notifications",
    title: "Notifications and preferences",
    summary:
      "How the portal notifies you and how to choose email, SMS, or in-app delivery.",
    roles: [],
    category: "account",
    keywords: ["notifications", "email", "sms", "alerts", "preferences"],
    body: [
      {
        type: "paragraph",
        text: "The portal notifies you whenever something important happens — a code is generated, a form is collected, a review needs attention, or a receipt is ready.",
      },
      {
        type: "paragraph",
        text: "The bell icon in the top bar shows unread notifications. Open Settings to choose how each kind of notification reaches you.",
      },
      {
        type: "list",
        items: [
          "In-app — always shown under the notification bell.",
          "Email — sent to your registered address.",
          "SMS — sent to your registered phone number, when enabled.",
        ],
      },
      {
        type: "link",
        label: "Open notification preferences",
        to: "/settings/preferences",
      },
    ],
  },
  {
    id: "common-help",
    title: "Getting help inside the portal",
    summary:
      "Using the help centre, the contextual help panel, guided tours, and tooltips.",
    roles: [],
    category: "getting-started",
    keywords: ["help", "support", "tour", "guide", "tooltip", "contextual"],
    body: [
      {
        type: "paragraph",
        text: "Help is available everywhere in the portal, scoped to what your role needs.",
      },
      {
        type: "list",
        items: [
          "Help centre — this section. Browse articles, step-by-step guides, FAQs, and the glossary.",
          "Contextual help — the question-mark button on each page opens a panel explaining that exact screen.",
          "Guided tours — interactive walkthroughs that highlight buttons and fields as you go.",
          "Field tooltips — small hint icons next to tricky form fields.",
          "Onboarding checklist — a getting-started checklist on your dashboard.",
        ],
      },
      {
        type: "note",
        variant: "tip",
        text: "Still stuck? Use the Contact page to reach the Ghana Audit Service support team.",
      },
    ],
  },
];
