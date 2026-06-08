import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { renderEmail, type EmailTemplate } from "~/server/emails";
import { BRAND } from "~/server/utils/branding";
import { getResolvedEmailConfig } from "~/server/utils/notification-config";

export type { EmailTemplate };

let transporter: Transporter | null = null;
let transporterSig: string | null = null;

/**
 * Get or (re)create the email transporter from the RESOLVED SMTP config
 * (in-app DB override → env fallback). The transporter is cached but keyed by
 * a signature of host/port/user/pass, so changing credentials in-app rebuilds
 * it on the next send/verify — no process restart required.
 */
async function getTransporter(): Promise<Transporter> {
  const cfg = await getResolvedEmailConfig();
  const sig = `${cfg.host}|${cfg.port}|${cfg.user}|${cfg.pass}`;
  if (!transporter || transporterSig !== sig) {
    transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.port === 465,
      auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
    });
    transporterSig = sig;
  }
  return transporter;
}

/**
 * Open a connection to the SMTP server and authenticate, WITHOUT sending mail.
 * Uses the same transporter (and therefore the same resolved credentials) that
 * real sends use, so a success here means real mail would authenticate too.
 *
 * Resolves `true` on success; rejects with the underlying nodemailer error,
 * which carries a `.code` (e.g. "EAUTH", "ECONNECTION", "ETIMEDOUT") and a
 * `.responseCode` SMTP status the caller can classify.
 */
export async function verifyEmailConnection(): Promise<true> {
  const transport = await getTransporter();
  await transport.verify();
  return true;
}

/**
 * Whether SMTP auth credentials are present in the resolved config (in-app DB
 * override → env fallback). Empty here on a prod build is the classic symptom
 * of plain `SMTP_USER`/`SMTP_PASS` env vars that should be `NUXT_`-prefixed
 * (and no in-app override set).
 */
export async function isSmtpAuthConfigured(): Promise<boolean> {
  const cfg = await getResolvedEmailConfig();
  return Boolean(cfg.user);
}

/**
 * Email data for templates
 */
export interface EmailData {
  to: string;
  subject: string;
  template: EmailTemplate;
  data: Record<string, unknown>;
}

/**
 * Generate HTML content for email templates. Kept as a re-export of
 * `renderEmail` so existing callers (and tests) don't need to change.
 */
export function generateEmailHtml(template: EmailTemplate, data: Record<string, unknown>): string {
  return renderEmail(template, data);
}

/**
 * Send an email
 */
export async function sendEmail(emailData: EmailData): Promise<boolean> {
  const cfg = await getResolvedEmailConfig();
  const transport = await getTransporter();

  const html = renderEmail(emailData.template, emailData.data);

  try {
    await transport.sendMail({
      from: `"${BRAND.fullName}" <${cfg.from}>`,
      to: emailData.to,
      subject: emailData.subject,
      html,
    });
    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}

/**
 * Send welcome email
 */
export async function sendWelcomeEmail(to: string, name: string): Promise<boolean> {
  const config = useRuntimeConfig();
  return sendEmail({
    to,
    subject: `Welcome to ${BRAND.fullName}`,
    template: "welcome",
    data: {
      name,
      loginUrl: `${config.public.appUrl}/auth/login`,
    },
  });
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  to: string,
  name: string,
  token: string
): Promise<boolean> {
  const config = useRuntimeConfig();
  return sendEmail({
    to,
    subject: "Password Reset Request",
    template: "password-reset",
    data: {
      name,
      resetUrl: `${config.public.appUrl}/auth/reset-password?token=${token}`,
    },
  });
}

/**
 * Send unique code email
 */
export async function sendUniqueCodeEmail(
  to: string,
  name: string,
  uniqueCode: string
): Promise<boolean> {
  return sendEmail({
    to,
    // M-5: keep the declaration code OUT of the email Subject header,
    // which is logged plaintext by every mail-server hop. Body retains it.
    subject: `Your Declaration Code Is Ready`,
    template: "unique-code",
    data: {
      name,
      uniqueCode,
    },
  });
}

/**
 * Send email verification email
 */
export async function sendVerificationEmail(
  to: string,
  name: string,
  token: string
): Promise<boolean> {
  const config = useRuntimeConfig();
  return sendEmail({
    to,
    subject: "Verify Your Email Address",
    template: "email-verification",
    data: {
      name,
      verificationUrl: `${config.public.appUrl}/auth/verify-email?token=${token}`,
    },
  });
}

/**
 * Send a staff-account invitation. The link points at /auth/accept-invite,
 * which verifies the email then hands off to the set-password form.
 */
export async function sendStaffInviteEmail(
  to: string,
  roleLabels: string,
  token: string
): Promise<boolean> {
  const config = useRuntimeConfig();
  return sendEmail({
    to,
    subject: "Activate your ADLA staff account",
    template: "staff-invite",
    data: {
      name: to,
      roleLabels,
      inviteUrl: `${config.public.appUrl}/auth/accept-invite?token=${token}`,
    },
  });
}

/**
 * Send contact acknowledgment email
 */
export async function sendContactAcknowledgment(
  to: string,
  name: string,
  _category: string
): Promise<boolean> {
  return sendEmail({
    to,
    subject: "We Received Your Inquiry",
    template: "welcome",
    data: {
      name,
      loginUrl: "",
    },
  });
}
