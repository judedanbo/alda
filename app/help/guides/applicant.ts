import type { HelpGuide } from "../types";

export const applicantGuides: HelpGuide[] = [
  {
    id: "guide-applicant-register",
    title: "Register and verify your email",
    description: "Create your account and confirm your email address.",
    roles: ["applicant"],
    category: "getting-started",
    estimatedMinutes: 5,
    relatedTourId: "tour-applicant-getting-started",
    steps: [
      {
        title: "Open the registration page",
        detail:
          "From the login page, choose \"Register\" to create a new account.",
      },
      {
        title: "Enter your details",
        detail:
          "Provide your email address, phone number, and a strong password, then submit the form.",
      },
      {
        title: "Check your inbox",
        detail:
          "We send a verification email to the address you registered with. Open it and click the verification link.",
        note: {
          variant: "tip",
          text: "If the email has not arrived after a few minutes, check your spam folder.",
        },
      },
      {
        title: "Confirm verification",
        detail:
          "After clicking the link, your email is marked as verified. You can now sign in and complete your profile.",
      },
    ],
  },
  {
    id: "guide-applicant-profile",
    title: "Complete your profile",
    description: "Fill in the three-step profile so the Legal Unit can verify you.",
    roles: ["applicant"],
    category: "getting-started",
    estimatedMinutes: 10,
    steps: [
      {
        title: "Step 1 — Personal details",
        detail:
          "Enter your full name and contact information exactly as they appear on your official records.",
      },
      {
        title: "Step 2 — Ghana Card",
        detail:
          "Upload clear photographs of the front and back of your Ghana Card.",
        note: {
          variant: "warning",
          text: "Make sure both images are sharp, well-lit, and show the whole card. Unreadable images delay verification.",
        },
      },
      {
        title: "Step 3 — Office details",
        detail:
          "Select your designation, public-office category, and institution, and enter the relevant dates.",
      },
      {
        title: "Submit for verification",
        detail:
          "Save your profile. It is now sent to the Legal Unit, who will review and verify your registration.",
      },
    ],
  },
  {
    id: "guide-applicant-new-declaration",
    title: "Create a declaration",
    description: "Generate a unique code to begin a new asset declaration.",
    roles: ["applicant"],
    category: "declarations",
    estimatedMinutes: 3,
    relatedTourId: "tour-applicant-new-declaration",
    steps: [
      {
        title: "Open New Declaration",
        detail:
          "From the navigation bar, choose \"New Declaration\". This option is enabled once your registration is verified.",
        note: {
          variant: "info",
          text: "If the option is disabled, you either are not yet verified or already have a declaration in progress.",
        },
      },
      {
        title: "Confirm and create",
        detail:
          "Review the details and create the declaration. The portal generates a unique code for it.",
      },
      {
        title: "Save your code",
        detail:
          "Copy your unique code. You receive it by email too. Take this code to the Audit Service to collect your physical form.",
      },
      {
        title: "Track progress",
        detail:
          "Open the declaration any time to follow its status timeline as officers record each step.",
      },
    ],
  },
  {
    id: "guide-applicant-reissue",
    title: "Request a lost-form reissue",
    description: "Ask for a replacement when you lose a collected form.",
    roles: ["applicant"],
    category: "form-handling",
    estimatedMinutes: 5,
    steps: [
      {
        title: "Open the declaration",
        detail:
          "Go to the detail page of the declaration whose form you lost. The reissue option is available while the declaration is at the Form Collected stage.",
      },
      {
        title: "Submit a reissue request",
        detail:
          "Use the reissue request action and describe what happened. This records a tracked request.",
      },
      {
        title: "Get an offline approval",
        detail:
          "Take a letter to the Auditor General or a Regional Auditor and obtain their approval.",
      },
      {
        title: "Bring the letter to the Legal Unit",
        detail:
          "The Legal Unit records the approval and reissues your form. Your declaration stays at Form Collected — return the new form through the normal process.",
      },
    ],
  },
];
