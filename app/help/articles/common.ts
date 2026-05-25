import type { HelpArticle } from "../types";

// Articles that apply to every role (roles: []).
export const commonArticles: HelpArticle[] = [
  {
    id: "common-act-550",
    title: "Act 550: the legal foundation",
    summary:
      "The Public Office Holders (Declaration of Assets and Disqualification) Act, 1998 — what it requires and how it shapes the portal.",
    roles: [],
    category: "getting-started",
    keywords: [
      "act 550",
      "law",
      "statute",
      "article 286",
      "constitution",
      "auditor-general",
      "chraj",
      "schedule i",
      "schedule ii",
    ],
    body: [
      {
        type: "paragraph",
        text: "The Public Office Holders (Declaration of Assets and Disqualification) Act, 1998 (Act 550) is the statute that gives effect to Chapter 24 of Ghana's 1992 Constitution, including Article 286(5). It was assented to on 4 May 1998 and gazetted on 8 May 1998. The Act has 16 sections in three Parts, plus two Schedules.",
      },
      {
        type: "heading",
        text: "Who must declare (Schedule I, Section 3)",
      },
      {
        type: "paragraph",
        text: "Schedule I lists every public office covered by the Act — from the President and Vice-President to MMDA presiding members, senior revenue and security officers, and any public officer whose salary equals or exceeds that of a Director in the Civil Service. Members of the Armed Forces are excluded from the asset-declaration requirement.",
      },
      {
        type: "heading",
        text: "When to declare (Section 1(4))",
      },
      {
        type: "list",
        items: [
          "Before taking office.",
          "At the end of every four years in the office.",
          "At the end of the term of office.",
          "In every case, the declaration must be submitted not later than six months after the triggering event.",
        ],
      },
      {
        type: "heading",
        text: "What must be declared (Section 4)",
      },
      {
        type: "list",
        items: [
          "Lands, houses and buildings.",
          "Farms.",
          "Concessions.",
          "Trust or family property in which the officer has a beneficial interest.",
          "Vehicles, plant and machinery, fishing boats, trawlers and generating plants.",
          "Business interests.",
          "Securities and bank balances.",
          "Bonds and treasury bills.",
          "Jewellery and objects of art of the value of ¢5 million or above.",
          "Life and other insurance policies.",
          "Liabilities — loans, overdrafts, mortgages, unpaid bills and any other debts.",
          "Any other property specified on the Schedule II declaration form.",
        ],
      },
      {
        type: "note",
        variant: "info",
        text: "Section 5 provides that any property acquired after a declaration which cannot reasonably be attributed to income, gift, loan, inheritance or another reasonable source is regarded as acquired illegally.",
      },
      {
        type: "heading",
        text: "Where it is submitted (Sections 1–2)",
      },
      {
        type: "paragraph",
        text: "Declarations are made in writing on the Schedule II form and submitted to the Auditor-General. The Auditor-General makes their own declaration to the President. This portal is the digital channel through which the Auditor-General now receives, records, reviews, and seals declarations.",
      },
      {
        type: "heading",
        text: "Consequences (Sections 6–8, Part II)",
      },
      {
        type: "list",
        items: [
          "Section 6 — a declaration may be produced in evidence before a competent court, a commission of inquiry under Article 278, or a CHRAJ investigator.",
          "Section 7 — failing to declare without reasonable excuse, or knowingly making a false declaration, contravenes the Act.",
          "Section 8 — allegations of contravention are made to the Commissioner for Human Rights and Administrative Justice (CHRAJ); when the Commissioner is the subject, to the Chief Justice. The matter is investigated unless the officer admits the contravention in writing.",
          "Part II (Sections 9–12) — adverse commission-of-inquiry findings or certain criminal convictions disqualify a person from holding offices listed in Schedule I.",
        ],
      },
      {
        type: "note",
        variant: "tip",
        text: "Schedule II is the official declaration form referenced by Section 1(2). Inside the portal, the same information is captured through the structured declaration workflow.",
      },
    ],
  },
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
        text: "The Asset Declaration Portal (ADLA) supports Ghana's Article 286(5) compliance process under the Public Office Holders (Declaration of Assets and Disqualification) Act, 1998 (Act 550). Public officers declare their assets and liabilities, and the Ghana Audit Service records, reviews, and seals each declaration through a tracked workflow.",
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
