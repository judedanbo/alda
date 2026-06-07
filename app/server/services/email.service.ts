import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { renderEmail, type EmailTemplate } from "~/server/emails";
import { BRAND } from "~/server/utils/branding";

export type { EmailTemplate };

let transporter: Transporter | null = null;

/**
 * Get or create email transporter
 */
function getTransporter(): Transporter {
  if (!transporter) {
    const config = useRuntimeConfig();
    transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: config.smtpUser
        ? {
            user: config.smtpUser,
            pass: config.smtpPass,
          }
        : undefined,
    });
  }
  return transporter;
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
  const config = useRuntimeConfig();
  const transport = getTransporter();

  const html = renderEmail(emailData.template, emailData.data);

  try {
    await transport.sendMail({
      from: `"${BRAND.fullName}" <${config.smtpFrom}>`,
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
