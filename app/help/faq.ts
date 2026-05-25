import type { FaqEntry } from "./types";

export const faqEntries: FaqEntry[] = [
  // --- Common --------------------------------------------------------------
  {
    id: "faq-when-to-declare",
    question: "When am I required to declare under Act 550?",
    answer:
      "Section 1(4) of Act 550 requires a declaration before taking office, at the end of every four years in office, and at the end of your term. In every case the declaration must be submitted within six months of the triggering event.",
    roles: [],
    category: "getting-started",
    keywords: [
      "act 550",
      "section 1",
      "when",
      "timing",
      "four years",
      "six months",
    ],
  },
  {
    id: "faq-what-to-declare",
    question: "What properties and liabilities must I declare?",
    answer:
      "Section 4 of Act 550 lists lands and buildings, farms, concessions, trust or family property, vehicles and plant and machinery, business interests, securities and bank balances, bonds and treasury bills, jewellery and objects of art valued at ¢5 million or above, life and other insurance policies, and any other items on the Schedule II form. All liabilities — loans, overdrafts, mortgages, and unpaid bills — must also be declared.",
    roles: [],
    category: "declarations",
    keywords: ["act 550", "section 4", "property", "assets", "liabilities"],
  },
  {
    id: "faq-who-declares",
    question: "Who is required to declare?",
    answer:
      "Schedule I of Act 550 lists every covered public office — the President and Vice-President, Speaker, MPs, Ministers, the Chief Justice and judges, Ambassadors, heads of MDAs and state-controlled corporations, Bank of Ghana Governor and Deputies, DCEs and MMDA presiding members, senior revenue and security officers, and any public officer whose salary equals or exceeds that of a Director in the Civil Service. The Armed Forces are excluded.",
    roles: [],
    category: "getting-started",
    keywords: ["act 550", "schedule i", "who", "covered", "public officers"],
  },
  {
    id: "faq-failure-to-declare",
    question: "What happens if I fail to declare or make a false declaration?",
    answer:
      "Under Section 7, failing to declare without reasonable excuse or knowingly making a false declaration is a contravention. Section 8 directs complaints to the Commissioner for Human Rights and Administrative Justice (CHRAJ) — or, when the Commissioner is the subject, to the Chief Justice — to be investigated. Section 5 treats any later asset that cannot reasonably be attributed to income, gift, loan or inheritance as illegally acquired. Part II of the Act covers disqualification arising from adverse findings or convictions.",
    roles: [],
    category: "getting-started",
    keywords: [
      "act 550",
      "section 7",
      "section 8",
      "false",
      "fail",
      "chraj",
      "penalty",
    ],
  },
  {
    id: "faq-forgot-password",
    question: "I forgot my password. How do I reset it?",
    answer:
      "On the login page, choose \"Forgot password\". We email you a reset link — open it and set a new password.",
    roles: [],
    category: "account",
    keywords: ["password", "reset", "forgot", "login"],
  },
  {
    id: "faq-verification-email",
    question: "I did not receive my verification email. What should I do?",
    answer:
      "Wait a few minutes and check your spam or junk folder. The email comes from the Ghana Audit Service. If it still has not arrived, contact support from the Contact page.",
    roles: [],
    category: "account",
    keywords: ["email", "verification", "spam"],
  },
  {
    id: "faq-change-notifications",
    question: "How do I change how I am notified?",
    answer:
      "Open Settings from the account menu in the top-right corner. You can turn email, SMS, and in-app notifications on or off for each kind of update.",
    roles: [],
    category: "account",
    keywords: ["notifications", "email", "sms", "settings"],
  },
  // --- Applicant -----------------------------------------------------------
  {
    id: "faq-new-declaration-disabled",
    question: "Why is the New Declaration option disabled?",
    answer:
      "New Declaration is disabled until your registration is Verified, and also while you already have a declaration in progress. Finish or resolve your current declaration first.",
    roles: ["applicant"],
    category: "declarations",
    keywords: ["new declaration", "disabled", "verified", "active"],
  },
  {
    id: "faq-how-many-declarations",
    question: "Can I have more than one declaration at a time?",
    answer:
      "No. You can only have one active declaration. Once it is sealed or resolved, you can create another.",
    roles: ["applicant"],
    category: "declarations",
    keywords: ["multiple", "one", "active declaration"],
  },
  {
    id: "faq-declaration-rejected",
    question: "My declaration was rejected. What happens now?",
    answer:
      "When a declaration is rejected, the portal automatically issues a new unique code. Use it to start a fresh declaration, addressing the reason given for the rejection.",
    roles: ["applicant"],
    category: "declarations",
    keywords: ["rejected", "new code", "resubmit"],
  },
  {
    id: "faq-lost-form",
    question: "I lost my physical form. Can I get a replacement?",
    answer:
      "Yes. While the declaration is at the Form Collected stage, submit a reissue request from its detail page, get an offline approval from the Auditor General or a Regional Auditor, and bring it to the Legal Unit.",
    roles: ["applicant"],
    category: "form-handling",
    keywords: ["lost form", "reissue", "replacement"],
  },
  // --- Officer -------------------------------------------------------------
  {
    id: "faq-officer-cannot-return",
    question: "Why can I not record a form return for a declaration?",
    answer:
      "A declaration must be at the Form Collected stage before a return can be recorded. Record the form collection first.",
    roles: ["schedule_officer"],
    category: "form-handling",
    keywords: ["form return", "form collected", "blocked"],
  },
  {
    id: "faq-officer-reject",
    question: "What happens when I reject a declaration?",
    answer:
      "Rejecting a declaration during review issues a new unique code to the applicant so they can start again. Always provide a clear rejection reason.",
    roles: ["schedule_officer"],
    category: "reviews",
    keywords: ["reject", "new code", "review"],
  },
  // --- Legal ---------------------------------------------------------------
  {
    id: "faq-legal-reissue-status",
    question: "Does approving a reissue change the declaration's status?",
    answer:
      "No. An approved reissue keeps the declaration at Form Collected. The applicant returns the reissued form through the normal form-return step.",
    roles: ["legal_unit"],
    category: "form-handling",
    keywords: ["reissue", "status", "form collected"],
  },
  {
    id: "faq-legal-decision-difference",
    question: "What is the difference between On Hold and More Information Required?",
    answer:
      "On Hold pauses a registration without asking for anything specific. More Information Required asks the applicant to update particular details before it can proceed.",
    roles: ["legal_unit"],
    category: "verification",
    keywords: ["on hold", "more info", "decision"],
  },
  // --- Admin ---------------------------------------------------------------
  {
    id: "faq-admin-deactivate",
    question: "What happens when I deactivate a user?",
    answer:
      "A deactivated user cannot sign in, but all of their existing records and audit history remain intact. You can reactivate the account later.",
    roles: ["admin"],
    category: "administration",
    keywords: ["deactivate", "user", "disable"],
  },
  {
    id: "faq-admin-edit-audit",
    question: "Can audit logs be edited or deleted?",
    answer:
      "No. Audit logs are immutable by design — they are a compliance record and cannot be changed or removed.",
    roles: ["admin"],
    category: "administration",
    keywords: ["audit", "immutable", "delete"],
  },
];
