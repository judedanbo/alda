/**
 * Registry of email templates. Each template is a TypeScript module
 * under `server/emails/` exporting a `(data) => string` renderer.
 *
 * `email.service.ts` uses `renderEmail(template, data)`; non-renderer
 * code (and tests) typically reach for `renderEmail` rather than the
 * individual modules.
 */
import { welcome } from "./welcome";
import { emailVerification } from "./email-verification";
import { passwordReset } from "./password-reset";
import { uniqueCode } from "./unique-code";
import { declarationSubmitted } from "./declaration-submitted";
import { declarationApproved } from "./declaration-approved";
import { declarationRejected } from "./declaration-rejected";
import { receiptReady } from "./receipt-ready";
import { pickupNotification } from "./pickup-notification";
import { verificationSubmitted } from "./verification-submitted";
import { verificationApproved } from "./verification-approved";
import { verificationRejected } from "./verification-rejected";
import { verificationOnHold } from "./verification-on-hold";
import { verificationMoreInfo } from "./verification-more-info";
import { staffInvite } from "./staff-invite";
import type { TemplateRenderer } from "./layout";

export type EmailTemplate =
  | "welcome"
  | "email-verification"
  | "password-reset"
  | "unique-code"
  | "declaration-submitted"
  | "declaration-approved"
  | "declaration-rejected"
  | "receipt-ready"
  | "pickup-notification"
  | "verification-submitted"
  | "verification-approved"
  | "verification-rejected"
  | "verification-on-hold"
  | "verification-more-info"
  | "staff-invite";

const TEMPLATES: Record<EmailTemplate, TemplateRenderer> = {
  "welcome": welcome,
  "email-verification": emailVerification,
  "password-reset": passwordReset,
  "unique-code": uniqueCode,
  "declaration-submitted": declarationSubmitted,
  "declaration-approved": declarationApproved,
  "declaration-rejected": declarationRejected,
  "receipt-ready": receiptReady,
  "pickup-notification": pickupNotification,
  "verification-submitted": verificationSubmitted,
  "verification-approved": verificationApproved,
  "verification-rejected": verificationRejected,
  "verification-on-hold": verificationOnHold,
  "verification-more-info": verificationMoreInfo,
  "staff-invite": staffInvite,
};

export function renderEmail(template: EmailTemplate, data: Record<string, unknown>): string {
  const renderer = TEMPLATES[template] ?? TEMPLATES.welcome;
  return renderer(data);
}
