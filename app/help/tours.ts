import type { TourDefinition } from "./types";

// Interactive tours. Each step's `element` is a [data-tour="..."] selector.
// The implementer must keep these data-tour attributes present on the matching
// elements:
//
//   nav-dashboard, nav-declarations, nav-new-declaration, nav-analytics,
//   nav-form-returns, nav-reviews, nav-receipts, nav-verifications,
//   nav-form-reissues, nav-verify-code, nav-users, nav-institutions,
//   nav-categories, nav-audit-logs, nav-web-analytics, nav-reports, nav-help
//        -> the per-role navigation links in layouts/dashboard.vue
//   help-button   -> the global "?" button in the dashboard header
//   onboarding    -> the OnboardingChecklist card on dashboards
//   new-declaration-form -> the main card on pages/applicant/declaration/new.vue
//   profile-progress, profile-personal, profile-continue
//        -> pages/applicant/profile/setup.vue
//   declaration-code, declaration-timeline, declaration-review-comments,
//   declaration-receipt, declaration-reissue
//        -> pages/applicant/declaration/[id].vue
//   analytics-stats, analytics-filters, analytics-kpis, analytics-timeline,
//   analytics-table
//        -> pages/applicant/analytics.vue
//   dashboard-phone-verify, dashboard-verification-banner,
//   dashboard-verification-docs, dashboard-email-verify,
//   dashboard-active-declaration, dashboard-verification-lookups,
//   dashboard-quick-actions, dashboard-declarations-overview,
//   dashboard-code-history
//        -> pages/applicant/dashboard.vue (conditional banners + section
//        cards; the email/phone/registration/active-declaration anchors are
//        conditionally rendered, so their tour steps self-skip when absent)
//   auth-login-form, auth-forgot-link, auth-register-link
//        -> pages/auth/login.vue
//   auth-register-form, auth-phone, auth-password, auth-terms
//        -> pages/auth/register.vue
//   auth-verify-card -> pages/auth/verify-email.vue
//   auth-forgot-form -> pages/auth/forgot-password.vue
//   auth-invite-form -> pages/auth/accept-invite.vue
//   edit-identity, edit-offices -> pages/applicant/profile/edit.vue
//   declarations-filter, declarations-list, declarations-pagination,
//   declarations-new -> pages/applicant/declarations.vue
//   account-overview, account-contact, account-password -> pages/account.vue
//   notifications-filter, notifications-mark-all, notifications-list
//        -> pages/notifications.vue
//   prefs-accessibility, prefs-channels, prefs-types
//        -> pages/settings/preferences.vue
//   contact-form, contact-category -> pages/contact.vue
//
// useTour skips any step whose target element is not on the page, so a missing
// optional target (e.g. a dismissed onboarding card) degrades gracefully.
export const tours: TourDefinition[] = [
  {
    id: "tour-applicant-getting-started",
    title: "Applicant: getting started",
    description: "A quick orientation tour of your dashboard and navigation.",
    roles: ["applicant"],
    route: "/applicant/dashboard",
    steps: [
      {
        title: "Welcome to the portal",
        description:
          "This short tour shows you around. You can stop it at any time and restart it from the help centre.",
      },
      {
        element: "[data-tour=\"nav-dashboard\"]",
        title: "Your dashboard",
        description:
          "Your dashboard is home base — it shows your declarations and what to do next.",
      },
      {
        element: "[data-tour=\"onboarding\"]",
        title: "Onboarding checklist",
        description:
          "Work through this checklist to reach your first declaration. Each item links to where you need to go.",
      },
      {
        element: "[data-tour=\"dashboard-email-verify\"]",
        title: "Verify your email",
        description:
          "Confirm your email address so we can send you declaration updates. This step disappears once it's verified.",
      },
      {
        element: "[data-tour=\"dashboard-phone-verify\"]",
        title: "Verify your phone",
        description:
          "If this banner appears, send yourself a 6-digit code and enter it here. A verified phone is required before you can create a declaration.",
      },
      {
        element: "[data-tour=\"dashboard-verification-banner\"]",
        title: "Registration under review",
        description:
          "Track your registration's review status here. The Legal Unit verifies your identity before you can declare; any requests for more information show up in this banner.",
      },
      {
        element: "[data-tour=\"dashboard-active-declaration\"]",
        title: "Your active declaration",
        description:
          "When you have a live declaration, its unique code, status and any reviewer comments appear here. Share the code with the Legal Unit to verify it.",
      },
      {
        element: "[data-tour=\"dashboard-verification-lookups\"]",
        title: "Verification lookups",
        description:
          "See how many times the Legal Unit has looked up your code to verify your declaration.",
      },
      {
        element: "[data-tour=\"dashboard-quick-actions\"]",
        title: "Quick actions",
        description:
          "Jump straight to starting a new declaration, browsing all your declarations, or editing your profile.",
      },
      {
        element: "[data-tour=\"nav-new-declaration\"]",
        title: "New declaration",
        description:
          "Once your email and phone are verified and the Legal Unit has verified your registration, create a declaration here to get your unique code.",
      },
      {
        element: "[data-tour=\"dashboard-declarations-overview\"]",
        title: "Declarations overview",
        description:
          "A snapshot of your declaration activity — totals plus pending, approved and rejected counts.",
      },
      {
        element: "[data-tour=\"dashboard-code-history\"]",
        title: "Code history",
        description:
          "Every unique code ever issued to you, with its status — handy if a declaration was rejected and reissued.",
      },
      {
        element: "[data-tour=\"help-button\"]",
        title: "Help is always here",
        description:
          "The question-mark button explains whichever page you are on. The Help link opens the full help centre.",
      },
      {
        title: "You are ready",
        description:
          "That is the tour. Complete your profile and you will be on your way.",
      },
    ],
  },
  {
    id: "tour-applicant-new-declaration",
    title: "Applicant: create a declaration",
    description: "Walk through creating a new declaration.",
    roles: ["applicant"],
    route: "/applicant/declaration/new",
    steps: [
      {
        title: "Creating a declaration",
        description:
          "Creating a declaration generates a unique code you take to the Audit Service.",
      },
      {
        element: "[data-tour=\"new-declaration-form\"]",
        title: "Start here",
        description:
          "Review the details on this page and create your declaration. Remember — only one declaration can be active at a time.",
      },
      {
        title: "Save your code",
        description:
          "After creating the declaration, copy the unique code. You will also receive it by email.",
      },
    ],
  },
  {
    id: "tour-applicant-profile-setup",
    title: "Applicant: complete your profile",
    description: "Walk through the three-step profile setup.",
    roles: ["applicant"],
    route: "/applicant/profile/setup",
    steps: [
      {
        title: "Completing your profile",
        description:
          "Your profile has three steps. The Legal Unit reviews it to verify your registration before you can declare assets.",
      },
      {
        element: "[data-tour=\"profile-progress\"]",
        title: "Track your progress",
        description:
          "This bar shows which of the three steps you are on. You can move back at any time.",
      },
      {
        element: "[data-tour=\"profile-personal\"]",
        title: "Step 1 — Personal details",
        description:
          "Enter your full name and Ghana Card number exactly as they appear on the card.",
      },
      {
        title: "Step 2 — Ghana Card images",
        description:
          "Next you upload a photo of your Ghana Card. Blurred or cropped images are the most common cause of verification delays — use sharp, well-lit shots.",
      },
      {
        title: "Step 3 — Office details",
        description:
          "Finally, add at least one public office you hold or have held. You can add several.",
      },
      {
        element: "[data-tour=\"profile-continue\"]",
        title: "Move through the steps",
        description:
          "Use this button to advance. On the last step it submits your profile for verification.",
      },
      {
        title: "That is the profile tour",
        description:
          "Once submitted, the Legal Unit reviews your registration and you will be notified of the outcome.",
      },
    ],
  },
  {
    id: "tour-applicant-declaration-detail",
    title: "Applicant: track a declaration",
    description: "Find your way around the declaration detail page.",
    roles: ["applicant"],
    steps: [
      {
        title: "Your declaration at a glance",
        description:
          "This page shows everything about one declaration — its code, its progress, and any actions you need to take.",
      },
      {
        element: "[data-tour=\"declaration-code\"]",
        title: "Declaration code",
        description:
          "This is the unique code for the declaration. Officers and the Legal Unit use it to find your record.",
      },
      {
        element: "[data-tour=\"declaration-timeline\"]",
        title: "Status timeline",
        description:
          "Follow each step here as officers record it — from form collection through to the sealed receipt.",
      },
      {
        element: "[data-tour=\"declaration-review-comments\"]",
        title: "Review comments",
        description:
          "If a reviewer flags a section, it appears here. Address these points before your next visit to the Audit Service.",
      },
      {
        element: "[data-tour=\"declaration-receipt\"]",
        title: "Your receipt",
        description:
          "Once the declaration is sealed, view or download your receipt PDF from here.",
      },
      {
        element: "[data-tour=\"declaration-reissue\"]",
        title: "Lost your form?",
        description:
          "While the form is collected, you can start a lost-form reissue request from this link.",
      },
      {
        title: "That is the tour",
        description:
          "Open any declaration from My Declarations to track it the same way.",
      },
    ],
  },
  {
    id: "tour-applicant-reissue",
    title: "Applicant: request a lost-form reissue",
    description: "What to do when you lose a collected declaration form.",
    roles: ["applicant"],
    steps: [
      {
        title: "When you lose a collected form",
        description:
          "If you lose your physical form while the declaration is at the Form Collected stage, you can request a reissue.",
      },
      {
        element: "[data-tour=\"declaration-reissue\"]",
        title: "Start the request",
        description:
          "Open the reissue request from this link on the declaration detail page. It records a tracked request and notifies the Legal Unit.",
      },
      {
        title: "Get the offline approval",
        description:
          "Take a letter explaining how the form was lost to the Auditor General or a Regional Auditor, and obtain their approval.",
      },
      {
        title: "Bring the letter to the Legal Unit",
        description:
          "The Legal Unit records the approval and reissues your form. The declaration stays at Form Collected — return the new form through the normal process.",
      },
    ],
  },
  {
    id: "tour-applicant-analytics",
    title: "Applicant: your analytics",
    description: "An orientation tour of your sealed-declaration insights.",
    roles: ["applicant"],
    route: "/applicant/analytics",
    steps: [
      {
        title: "Your declaration analytics",
        description:
          "This page summarises your sealed declarations.",
      },
      {
        element: "[data-tour=\"analytics-stats\"]",
        title: "Totals at a glance",
        description: "A quick count of your declarations by status.",
      },
      {
        element: "[data-tour=\"analytics-filters\"]",
        title: "Filter the view",
        description:
          "Narrow everything below by date range and other criteria.",
      },
      {
        element: "[data-tour=\"analytics-kpis\"]",
        title: "Key metrics",
        description:
          "Headline figures for your sealed declarations, including processing times.",
      },
      {
        element: "[data-tour=\"analytics-timeline\"]",
        title: "Sealed over time",
        description:
          "How your sealed declarations are distributed across months.",
      },
      {
        element: "[data-tour=\"analytics-table\"]",
        title: "Your declarations",
        description:
          "Sort and page through your sealed declarations in detail.",
      },
      {
        title: "That is the tour",
        description: "The help centre has more on reading these figures.",
      },
    ],
  },
  {
    id: "tour-applicant-login",
    title: "Applicant: signing in",
    description: "How to sign in and what to do if you are locked out.",
    roles: ["applicant"],
    route: "/auth/login",
    steps: [
      {
        title: "Signing in",
        description:
          "Use the email address and password you registered with. This short tour points out the things you might need.",
      },
      {
        element: "[data-tour=\"auth-login-form\"]",
        title: "Enter your details",
        description:
          "Type your email and password, then select Sign in. Repeated failed attempts are paused for a short time to protect your account.",
      },
      {
        element: "[data-tour=\"auth-forgot-link\"]",
        title: "Forgot your password?",
        description:
          "Use this link to receive a single-use reset email if you cannot remember your password.",
      },
      {
        element: "[data-tour=\"auth-register-link\"]",
        title: "New to the portal?",
        description:
          "If you have not registered yet, create an account here first.",
      },
    ],
  },
  {
    id: "tour-applicant-register",
    title: "Applicant: create your account",
    description: "Walk through registering for the portal.",
    roles: ["applicant"],
    route: "/auth/register",
    steps: [
      {
        title: "Creating your account",
        description:
          "Register with details you control — the Legal Unit verifies your registration against them later.",
      },
      {
        element: "[data-tour=\"auth-register-form\"]",
        title: "Your details",
        description:
          "Enter the email address and password you want to sign in with.",
      },
      {
        element: "[data-tour=\"auth-phone\"]",
        title: "Phone number",
        description:
          "Enter a local number (e.g. 0241234567) or include the country code (e.g. +233241234567). You verify it later from your dashboard.",
      },
      {
        element: "[data-tour=\"auth-password\"]",
        title: "A strong password",
        description:
          "Your password needs at least 8 characters with an uppercase letter, a lowercase letter, and a number. The checklist turns green as you meet each rule.",
      },
      {
        element: "[data-tour=\"auth-terms\"]",
        title: "Accept the terms",
        description:
          "Tick this box to accept the Terms of Service and Privacy Policy, then create your account.",
      },
      {
        title: "What happens next",
        description:
          "We email you a verification link. Verify your email, sign in, and complete your profile for the Legal Unit to review.",
      },
    ],
  },
  {
    id: "tour-applicant-verify-email",
    title: "Applicant: verify your email",
    description: "What this page does and what to do if it fails.",
    roles: ["applicant"],
    route: "/auth/verify-email",
    steps: [
      {
        title: "Verifying your email",
        description:
          "This page checks the verification link from your email automatically — you do not need to type anything.",
      },
      {
        element: "[data-tour=\"auth-verify-card\"]",
        title: "The three outcomes",
        description:
          "While loading we are checking the link. Success means your email is verified. An error means the link expired or was already used — sign in and request a new one from your dashboard.",
      },
      {
        title: "If it failed",
        description:
          "Sign in and use the Resend option on your dashboard to get a fresh verification email.",
      },
    ],
  },
  {
    id: "tour-applicant-password-reset",
    title: "Applicant: reset your password",
    description: "How to request and set a new password.",
    roles: ["applicant"],
    route: "/auth/forgot-password",
    steps: [
      {
        title: "Resetting your password",
        description:
          "If you cannot sign in, you can reset your password in two short steps.",
      },
      {
        element: "[data-tour=\"auth-forgot-form\"]",
        title: "Request a reset link",
        description:
          "Enter your registered email. If an account exists, we send a single-use reset link to it. Check your spam folder if nothing arrives.",
      },
      {
        title: "Set a new password",
        description:
          "Open the link from the email and choose a new password that satisfies every item on the strength checklist. The link works only once.",
      },
      {
        title: "Then sign in",
        description:
          "Once the password is updated, return to the sign-in page and log in with it.",
      },
    ],
  },
  {
    id: "tour-applicant-accept-invite",
    title: "Applicant: activate your account",
    description: "Set your password after an administrator invites you.",
    roles: ["applicant"],
    route: "/auth/accept-invite",
    steps: [
      {
        title: "Activating your account",
        description:
          "An administrator created your account and invited you. This page confirms the invite and lets you set your password.",
      },
      {
        element: "[data-tour=\"auth-invite-form\"]",
        title: "Choose a password",
        description:
          "Pick a password that meets every item on the strength checklist, confirm it, and activate your account.",
      },
      {
        title: "Then sign in",
        description:
          "After activating, sign in with your email and the password you just set. If the link has expired, ask an administrator to resend the invite.",
      },
    ],
  },
  {
    id: "tour-applicant-edit-profile",
    title: "Applicant: edit your profile",
    description: "Update your office details after setup.",
    roles: ["applicant"],
    route: "/applicant/profile/edit",
    steps: [
      {
        title: "Editing your profile",
        description:
          "You can update your office details here at any time. Your legal identity is fixed once verified.",
      },
      {
        element: "[data-tour=\"edit-identity\"]",
        title: "Personal details are read-only",
        description:
          "Your name and ID number cannot be changed here — contact an administrator if they are wrong.",
      },
      {
        element: "[data-tour=\"edit-offices\"]",
        title: "Manage your offices",
        description:
          "Add a new office, edit an existing one, or remove one you no longer hold. Keep at least one office on file.",
      },
      {
        title: "Resubmitting after a request",
        description:
          "If the Legal Unit asked for more information, update what they mentioned here and resubmit from your dashboard.",
      },
    ],
  },
  {
    id: "tour-applicant-declarations-list",
    title: "Applicant: your declarations",
    description: "Find and track every declaration you have created.",
    roles: ["applicant"],
    route: "/applicant/declarations",
    steps: [
      {
        title: "All your declarations",
        description:
          "This page lists every declaration you have created, current and past.",
      },
      {
        element: "[data-tour=\"declarations-filter\"]",
        title: "Filter by status",
        description:
          "Narrow the list to a single stage — for example Under Review or Sealed.",
      },
      {
        element: "[data-tour=\"declarations-list\"]",
        title: "Open a declaration",
        description:
          "Select any declaration to see its full status timeline, review comments, and receipt.",
      },
      {
        element: "[data-tour=\"declarations-new\"]",
        title: "Start a new one",
        description:
          "Create a new declaration here. This is available once your registration is verified and you have no active declaration.",
      },
    ],
  },
  {
    id: "tour-applicant-account",
    title: "Applicant: your account",
    description: "Manage your email, phone, and password.",
    roles: ["applicant"],
    route: "/account",
    steps: [
      {
        title: "Your account",
        description:
          "This page manages your sign-in details and shows your verification status and roles.",
      },
      {
        element: "[data-tour=\"account-overview\"]",
        title: "Account overview",
        description:
          "See your email and phone verification status, your roles, and when you joined. Resend the email verification from here if needed.",
      },
      {
        element: "[data-tour=\"account-contact\"]",
        title: "Update your contact details",
        description:
          "Change your email or phone number here. Changing either requires re-verification before notifications resume on that channel.",
      },
      {
        element: "[data-tour=\"account-password\"]",
        title: "Change your password",
        description:
          "Set a new password. Doing so signs you out of all your other devices.",
      },
      {
        title: "Preferences",
        description:
          "Notification channels and accessibility options live on the Preferences page, linked at the bottom of this one.",
      },
    ],
  },
  {
    id: "tour-applicant-notifications",
    title: "Applicant: your notifications",
    description: "Read and manage your notifications.",
    roles: ["applicant"],
    route: "/notifications",
    steps: [
      {
        title: "Your notifications",
        description:
          "Every update about your declarations and verification appears here.",
      },
      {
        element: "[data-tour=\"notifications-filter\"]",
        title: "Show unread only",
        description:
          "Toggle this to focus on notifications you have not read yet.",
      },
      {
        element: "[data-tour=\"notifications-mark-all\"]",
        title: "Mark all as read",
        description:
          "Clear the unread badge in one step once you have caught up.",
      },
      {
        element: "[data-tour=\"notifications-list\"]",
        title: "Each notification",
        description:
          "Unread items are highlighted. Use Mark as read on any single one as you go.",
      },
      {
        title: "Choosing channels",
        description:
          "Decide which notifications reach you by email, SMS, or in-app on the Preferences page.",
      },
    ],
  },
  {
    id: "tour-applicant-preferences",
    title: "Applicant: notifications & accessibility",
    description: "Tune how you are notified and how the portal looks.",
    roles: ["applicant"],
    route: "/settings/preferences",
    steps: [
      {
        title: "Your preferences",
        description:
          "Adjust accessibility and notification settings here. Your choices are saved to your account and synced across devices.",
      },
      {
        element: "[data-tour=\"prefs-accessibility\"]",
        title: "Display & accessibility",
        description:
          "Change text size, colour theme, reduced motion, and other display options to suit you.",
      },
      {
        element: "[data-tour=\"prefs-channels\"]",
        title: "Notification channels",
        description:
          "Turn email, SMS, and in-app notifications on or off. A message is only delivered on a channel you have enabled.",
      },
      {
        element: "[data-tour=\"prefs-types\"]",
        title: "Which updates you get",
        description:
          "Choose the kinds of updates you receive. Switch on Advanced view to control each channel per notification type. Security messages such as password resets are always sent.",
      },
      {
        title: "Save your changes",
        description:
          "Remember to select Save Preferences once you are happy with your choices.",
      },
    ],
  },
  {
    id: "tour-applicant-verification-response",
    title: "Applicant: respond to an information request",
    description: "What to do when the Legal Unit asks for more information.",
    roles: ["applicant"],
    route: "/applicant/dashboard",
    steps: [
      {
        title: "When more information is needed",
        description:
          "If the Legal Unit needs more from you, an Action Required banner appears on your dashboard. This tour shows how to respond.",
      },
      {
        element: "[data-tour=\"dashboard-verification-banner\"]",
        title: "Read the request",
        description:
          "The banner shows the reviewer's message explaining exactly what they need from you.",
      },
      {
        element: "[data-tour=\"dashboard-verification-docs\"]",
        title: "Upload supporting documents",
        description:
          "Add the documents the reviewer asked for here. You can upload several and remove any you added by mistake.",
      },
      {
        title: "Resubmit for review",
        description:
          "Use Edit Profile & Resubmit to update any details and send your registration back to the Legal Unit.",
      },
    ],
  },
  {
    id: "tour-applicant-contact",
    title: "Applicant: contact support",
    description: "How to send the support team a message.",
    roles: ["applicant"],
    route: "/contact",
    steps: [
      {
        title: "Contacting support",
        description:
          "Use this form to reach the Ghana Audit Service about anything to do with the portal.",
      },
      {
        element: "[data-tour=\"contact-category\"]",
        title: "Pick a category",
        description:
          "Choosing the closest category helps route your message to the right team.",
      },
      {
        element: "[data-tour=\"contact-form\"]",
        title: "Tell us what you need",
        description:
          "Add a clear subject and message. Include your declaration code if your question is about a specific declaration.",
      },
      {
        title: "What happens next",
        description:
          "We aim to respond within 2–3 business days to the email address you provide.",
      },
    ],
  },
  {
    id: "tour-officer-review",
    title: "Officer: review workflow",
    description: "An orientation tour of the officer review queues.",
    roles: ["schedule_officer"],
    route: "/officer/reviews",
    steps: [
      {
        title: "The review workflow",
        description:
          "As a Schedule Officer you drive a declaration from form collection through to its sealed receipt.",
      },
      {
        element: "[data-tour=\"nav-reviews\"]",
        title: "Reviews",
        description:
          "Review declarations here, section by section — eight sections in all.",
      },
      {
        title: "Sections and decisions",
        description:
          "Mark each section acceptable or flag it with a comment. When every section is acceptable you can approve the declaration; otherwise you can reject it with a reason.",
      },
      {
        element: "[data-tour=\"nav-receipts\"]",
        title: "Receipts",
        description:
          "After approval, generate the receipt here to seal the declaration.",
      },
      {
        element: "[data-tour=\"help-button\"]",
        title: "Help is always here",
        description:
          "Use the question-mark button for guidance on whichever page you are on.",
      },
      {
        title: "You are ready",
        description: "That is the tour. The help centre has the full details.",
      },
    ],
  },
  {
    id: "tour-legal-verification",
    title: "Legal Unit: verification workflow",
    description: "An orientation tour of the Legal Unit areas.",
    roles: ["legal_unit"],
    route: "/legal/verifications",
    steps: [
      {
        title: "The Legal Unit workflow",
        description:
          "You verify applicant registrations, verify declaration codes, and process lost-form reissues.",
      },
      {
        element: "[data-tour=\"nav-verifications\"]",
        title: "Applicant verifications",
        description:
          "Review registrations here and decide Verified, On Hold, More Information Required, or Rejected.",
      },
      {
        element: "[data-tour=\"nav-verify-code\"]",
        title: "Verify a code",
        description:
          "Confirm a declaration's authenticity by entering its unique code.",
      },
      {
        element: "[data-tour=\"nav-form-reissues\"]",
        title: "Form reissues",
        description:
          "Process lost-form reissue requests by recording the offline approval.",
      },
      {
        title: "You are ready",
        description: "That is the tour. The help centre has the full details.",
      },
    ],
  },
  {
    id: "tour-admin-overview",
    title: "Administrator: portal overview",
    description: "An orientation tour of the administration areas.",
    roles: ["admin"],
    route: "/admin/dashboard",
    steps: [
      {
        title: "Administering the portal",
        description:
          "You manage users, reference data, and the compliance record across the whole portal.",
      },
      {
        element: "[data-tour=\"nav-users\"]",
        title: "Users",
        description:
          "Create accounts, assign roles, and activate or deactivate users.",
      },
      {
        element: "[data-tour=\"nav-audit-logs\"]",
        title: "Audit logs",
        description:
          "Review the immutable record of every action taken in the portal.",
      },
      {
        element: "[data-tour=\"help-button\"]",
        title: "Help is always here",
        description:
          "Use the question-mark button for guidance on whichever page you are on.",
      },
      {
        title: "You are ready",
        description: "That is the tour. The help centre has the full details.",
      },
    ],
  },
];
