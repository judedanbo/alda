import type { FieldTooltip } from "./types";

// Inline hint text for complex form fields. Keyed "<form>.<field>" and looked
// up by FieldTooltip.vue via getFieldTooltip().
export const fieldTooltips: FieldTooltip[] = [
  // Applicant profile
  {
    id: "profile.ghanaCardNumber",
    text: "Enter the personal ID number printed on your Ghana Card, in the format GHA-XXXXXXXXX-X.",
  },
  {
    id: "profile.ghanaCardFront",
    text: "Upload a clear, well-lit photo of the front of your Ghana Card. The whole card must be visible and readable.",
  },
  {
    id: "profile.ghanaCardBack",
    text: "Upload a clear photo of the back of your Ghana Card. Blurred or cropped images delay verification.",
  },
  {
    id: "profile.idType",
    text: "Most applicants must use a Ghana Card. Pick an alternate ID only if you genuinely don't have one yet — for example, your card is being reissued or you are a foreign national appointed to a qualifying office.",
  },
  {
    id: "profile.alternateIdNumber",
    text: "Enter the ID number exactly as it appears on the document. The Legal Unit will compare it against your uploaded scan.",
  },
  {
    id: "profile.alternateIdReason",
    text: "Pick the closest reason. This helps the Legal Unit reviewer route your application and decide what extra checks they need.",
  },
  {
    id: "profile.alternateIdScan",
    text: "Upload a clear, well-lit photo or scan of the document page that shows your full name and ID number.",
  },
  {
    id: "profile.designation",
    text: "Your official job title in the public office you hold.",
  },
  {
    id: "profile.category",
    text: "The Article 286(5) public-office category your role falls under. Ask your institution if you are unsure.",
  },
  {
    id: "profile.institution",
    text: "The public body you work for. Choose the closest match from the list.",
  },
  {
    id: "profile.officeStartDate",
    text: "The date you took up this office or role.",
  },
  {
    id: "profile.officeEndDate",
    text: "The date you left this office. Leave blank if you still hold it.",
  },
  // New declaration
  {
    id: "declaration.confirm",
    text: "Creating a declaration generates a unique code. You can only have one active declaration at a time.",
  },
  // Officer section review
  {
    id: "review.sectionAcceptable",
    text: "Mark a section acceptable only when it is complete and correct.",
  },
  {
    id: "review.sectionComment",
    text: "Describe what needs attention. The applicant sees this comment and must resolve it.",
  },
  {
    id: "review.rejectReason",
    text: "Rejecting issues a new code to the applicant. Give a clear, specific reason.",
  },
  // Legal verification
  {
    id: "verification.decision",
    text: "Verified lets the applicant declare. On Hold pauses without a specific request. More Information Required asks for updates. Rejected stops the registration.",
  },
  {
    id: "verification.reason",
    text: "The reason is sent to the applicant with the decision. Be clear and specific.",
  },
  // Legal reissue
  {
    id: "reissue.approverType",
    text: "Choose who signed the offline approval letter — the Auditor General or a Regional Auditor.",
  },
  {
    id: "reissue.letterScan",
    text: "Upload the scanned copy of the signed approval letter.",
  },
  // Account
  {
    id: "account.email",
    text: "Changing your email sends a verification link to the new address. Email notifications pause until you verify it.",
  },
  {
    id: "account.phone",
    text: "Changing your phone resets phone verification. Verify the new number to keep receiving SMS and to create declarations.",
  },
  {
    id: "account.currentPassword",
    text: "Enter your existing password to confirm it's you before setting a new one. Changing your password signs you out of all other devices.",
  },
  // Notification preferences
  {
    id: "preferences.channelEmail",
    text: "When off, you receive no email notifications. Security messages such as password resets are always sent.",
  },
  {
    id: "preferences.channelSms",
    text: "When off, you receive no SMS notifications. A notification is only delivered on a channel you have enabled.",
  },
  {
    id: "preferences.channelInApp",
    text: "When off, notifications no longer appear inside the portal. You can re-enable this at any time.",
  },
  // Contact support
  {
    id: "contact.category",
    text: "Pick the closest category — it helps route your message to the right team.",
  },
  // Admin
  {
    id: "user.roles",
    text: "Roles control which areas a user can reach. A user may hold more than one role.",
  },
  {
    id: "category.articleReference",
    text: "The Article 286(5) clause this public-office category corresponds to.",
  },
];
