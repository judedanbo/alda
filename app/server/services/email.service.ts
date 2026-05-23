import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

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
 * Email template types
 */
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
  | "verification-more-info";

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
 * Generate HTML content for email templates. Exported for testing.
 */
export function generateEmailHtml(template: EmailTemplate, data: Record<string, unknown>): string {
  const baseStyle = `
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background-color: #006B3F; color: white; padding: 20px; text-align: center; }
      .content { padding: 30px 20px; background-color: #f9f9f9; }
      .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
      .button { display: inline-block; padding: 12px 24px; background-color: #006B3F; color: white; text-decoration: none; border-radius: 4px; }
      .code { font-size: 24px; font-weight: bold; color: #006B3F; letter-spacing: 2px; padding: 20px; background: #e8f5e9; text-align: center; margin: 20px 0; }
    </style>
  `;

  const templates: Record<EmailTemplate, string> = {
    welcome: `
      ${baseStyle}
      <div class="container">
        <div class="header">
          <h1>Welcome to Asset Declaration Portal</h1>
        </div>
        <div class="content">
          <p>Dear ${data.name || "User"},</p>
          <p>Welcome to the Ghana Asset Declaration Portal. Your account has been successfully created.</p>
          <p>You can now log in and complete your profile to start submitting your asset declarations.</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${data.loginUrl}" class="button">Login to Your Account</a>
          </p>
          <p>If you have any questions, please contact our support team.</p>
        </div>
        <div class="footer">
          <p>Republic of Ghana - Asset Declaration System</p>
          <p>Article 286(5) of the 1992 Constitution</p>
        </div>
      </div>
    `,

    "email-verification": `
      ${baseStyle}
      <div class="container">
        <div class="header">
          <h1>Verify Your Email</h1>
        </div>
        <div class="content">
          <p>Dear ${data.name || "User"},</p>
          <p>Please click the button below to verify your email address:</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${data.verificationUrl}" class="button">Verify Email</a>
          </p>
          <p>This link will expire in 24 hours.</p>
          <p>If you did not create an account, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>Republic of Ghana - Asset Declaration System</p>
        </div>
      </div>
    `,

    "password-reset": `
      ${baseStyle}
      <div class="container">
        <div class="header">
          <h1>Password Reset Request</h1>
        </div>
        <div class="content">
          <p>Dear ${data.name || "User"},</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${data.resetUrl}" class="button">Reset Password</a>
          </p>
          <p>This link will expire in 1 hour.</p>
          <p>If you did not request a password reset, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>Republic of Ghana - Asset Declaration System</p>
        </div>
      </div>
    `,

    "unique-code": `
      ${baseStyle}
      <div class="container">
        <div class="header">
          <h1>Your Unique Declaration Code</h1>
        </div>
        <div class="content">
          <p>Dear ${data.name || "User"},</p>
          <p>Your asset declaration has been received. Your unique code is:</p>
          <div class="code">${data.uniqueCode}</div>
          <p><strong>Important:</strong> Please keep this code safe. You will need it to:</p>
          <ul>
            <li>Track the status of your declaration</li>
            <li>Collect your receipt after approval</li>
            <li>Reference your declaration in any correspondence</li>
          </ul>
          <p>You can check your declaration status at any time by logging into your account.</p>
        </div>
        <div class="footer">
          <p>Republic of Ghana - Asset Declaration System</p>
          <p>Article 286(5) of the 1992 Constitution</p>
        </div>
      </div>
    `,

    "declaration-submitted": `
      ${baseStyle}
      <div class="container">
        <div class="header">
          <h1>Declaration Submitted</h1>
        </div>
        <div class="content">
          <p>Dear ${data.name || "User"},</p>
          <p>Your asset declaration has been successfully submitted for review.</p>
          <p><strong>Declaration Code:</strong> ${data.uniqueCode}</p>
          <p><strong>Submitted:</strong> ${data.submittedAt}</p>
          <p>Our team will review your declaration and you will be notified once a decision is made.</p>
        </div>
        <div class="footer">
          <p>Republic of Ghana - Asset Declaration System</p>
        </div>
      </div>
    `,

    "declaration-approved": `
      ${baseStyle}
      <div class="container">
        <div class="header" style="background-color: #16A34A;">
          <h1>Declaration Approved</h1>
        </div>
        <div class="content">
          <p>Dear ${data.name || "User"},</p>
          <p>Congratulations! Your asset declaration has been <strong>approved</strong>.</p>
          <p><strong>Declaration Code:</strong> ${data.uniqueCode}</p>
          <p><strong>Approved:</strong> ${data.approvedAt}</p>
          <p>Your receipt is now ready for collection. You will receive a separate notification with pickup details.</p>
        </div>
        <div class="footer">
          <p>Republic of Ghana - Asset Declaration System</p>
        </div>
      </div>
    `,

    "declaration-rejected": `
      ${baseStyle}
      <div class="container">
        <div class="header" style="background-color: #DC2626;">
          <h1>Declaration Requires Attention</h1>
        </div>
        <div class="content">
          <p>Dear ${data.name || "User"},</p>
          <p>Your asset declaration could not be approved at this time.</p>
          <p><strong>Declaration Code:</strong> ${data.uniqueCode}</p>
          <p><strong>Reason:</strong></p>
          <p style="padding: 15px; background: #fef2f2; border-left: 4px solid #DC2626;">${data.rejectionReason}</p>
          <p>A new unique code will be issued for you to submit a corrected declaration.</p>
          <p>If you have questions, please contact our support team.</p>
        </div>
        <div class="footer">
          <p>Republic of Ghana - Asset Declaration System</p>
        </div>
      </div>
    `,

    "receipt-ready": `
      ${baseStyle}
      <div class="container">
        <div class="header">
          <h1>Receipt Ready</h1>
        </div>
        <div class="content">
          <p>Dear ${data.name || "User"},</p>
          <p>Your asset declaration receipt is now ready.</p>
          <p><strong>Receipt Number:</strong> ${data.receiptNumber}</p>
          <p><strong>Declaration Code:</strong> ${data.uniqueCode}</p>
          <p>You can download a copy of your receipt from your account dashboard.</p>
        </div>
        <div class="footer">
          <p>Republic of Ghana - Asset Declaration System</p>
        </div>
      </div>
    `,

    "pickup-notification": `
      ${baseStyle}
      <div class="container">
        <div class="header">
          <h1>Pickup Notification</h1>
        </div>
        <div class="content">
          <p>Dear ${data.name || "User"},</p>
          <p>Your sealed asset declaration document is ready for pickup.</p>
          <p><strong>Declaration Code:</strong> ${data.uniqueCode}</p>
          <p><strong>Receipt Number:</strong> ${data.receiptNumber}</p>
          <hr style="margin: 20px 0;">
          <p><strong>Pickup Details:</strong></p>
          <p>Please bring a valid Ghana Card for identification when collecting your document.</p>
          ${data.authorizedPerson ? `<p><strong>Authorized Person:</strong> ${data.authorizedPerson} (${data.authorizedPhone})</p>` : ""}
        </div>
        <div class="footer">
          <p>Republic of Ghana - Asset Declaration System</p>
        </div>
      </div>
    `,

    "verification-submitted": `
      ${baseStyle}
      <div class="container">
        <div class="header">
          <h1>Registration Under Review</h1>
        </div>
        <div class="content">
          <p>Dear ${data.name || "User"},</p>
          <p>Your registration is now being reviewed by our legal office. This process typically takes 1-3 business days.</p>
          <p>You will be notified once a decision has been made. You can check your verification status at any time by logging into your account.</p>
        </div>
        <div class="footer">
          <p>Republic of Ghana - Asset Declaration System</p>
        </div>
      </div>
    `,

    "verification-approved": `
      ${baseStyle}
      <div class="container">
        <div class="header" style="background-color: #16A34A;">
          <h1>Registration Verified</h1>
        </div>
        <div class="content">
          <p>Dear ${data.name || "User"},</p>
          <p>Congratulations! Your registration has been <strong>verified</strong> by the legal office.</p>
          <p>You can now create and submit asset declarations through your dashboard.</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${data.dashboardUrl}" class="button">Go to Dashboard</a>
          </p>
        </div>
        <div class="footer">
          <p>Republic of Ghana - Asset Declaration System</p>
        </div>
      </div>
    `,

    "verification-rejected": `
      ${baseStyle}
      <div class="container">
        <div class="header" style="background-color: #DC2626;">
          <h1>Registration Not Approved</h1>
        </div>
        <div class="content">
          <p>Dear ${data.name || "User"},</p>
          <p>Your registration could not be approved at this time.</p>
          <p><strong>Reason:</strong></p>
          <p style="padding: 15px; background: #fef2f2; border-left: 4px solid #DC2626;">${data.reason}</p>
          ${data.messageToApplicant ? `<p><strong>Message from reviewer:</strong></p><p style="padding: 15px; background: #f0f9ff; border-left: 4px solid #3B82F6;">${data.messageToApplicant}</p>` : ""}
          <p>You can update your profile and resubmit for verification through your dashboard.</p>
        </div>
        <div class="footer">
          <p>Republic of Ghana - Asset Declaration System</p>
        </div>
      </div>
    `,

    "verification-on-hold": `
      ${baseStyle}
      <div class="container">
        <div class="header" style="background-color: #EA580C;">
          <h1>Registration Under Investigation</h1>
        </div>
        <div class="content">
          <p>Dear ${data.name || "User"},</p>
          <p>Your registration has been placed on hold for further review.</p>
          <p><strong>Reason:</strong></p>
          <p style="padding: 15px; background: #fff7ed; border-left: 4px solid #EA580C;">${data.reason}</p>
          <p>Please wait for further updates. You will be notified once a final decision is made.</p>
        </div>
        <div class="footer">
          <p>Republic of Ghana - Asset Declaration System</p>
        </div>
      </div>
    `,

    "verification-more-info": `
      ${baseStyle}
      <div class="container">
        <div class="header" style="background-color: #2563EB;">
          <h1>Additional Information Required</h1>
        </div>
        <div class="content">
          <p>Dear ${data.name || "User"},</p>
          <p>The legal office requires additional information to complete your registration verification.</p>
          <p><strong>Request:</strong></p>
          <p style="padding: 15px; background: #f0f9ff; border-left: 4px solid #2563EB;">${data.messageToApplicant}</p>
          <p>Please update your profile with the requested information and resubmit for verification.</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${data.dashboardUrl}" class="button">Update Profile</a>
          </p>
        </div>
        <div class="footer">
          <p>Republic of Ghana - Asset Declaration System</p>
        </div>
      </div>
    `,
  };

  return templates[template] || templates.welcome;
}

/**
 * Send an email
 */
export async function sendEmail(emailData: EmailData): Promise<boolean> {
  const config = useRuntimeConfig();
  const transport = getTransporter();

  const html = generateEmailHtml(emailData.template, emailData.data);

  try {
    await transport.sendMail({
      from: `"Asset Declaration Portal" <${config.smtpFrom}>`,
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
    subject: "Welcome to Asset Declaration Portal",
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
    subject: `Your Declaration Code: ${uniqueCode}`,
    template: "unique-code",
    data: {
      name,
      uniqueCode,
    },
  });
}

/**
 * Send declaration status email
 */
export async function sendDeclarationStatusEmail(
  to: string,
  name: string,
  status: "submitted" | "approved" | "rejected",
  uniqueCode: string,
  additionalData?: Record<string, unknown>
): Promise<boolean> {
  const templates: Record<"submitted" | "approved" | "rejected", { subject: string; template: EmailTemplate }> = {
    submitted: {
      subject: "Declaration Submitted Successfully",
      template: "declaration-submitted",
    },
    approved: {
      subject: "Declaration Approved",
      template: "declaration-approved",
    },
    rejected: {
      subject: "Declaration Requires Attention",
      template: "declaration-rejected",
    },
  };

  const { subject, template } = templates[status];

  return sendEmail({
    to,
    subject,
    template,
    data: {
      name,
      uniqueCode,
      ...additionalData,
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
