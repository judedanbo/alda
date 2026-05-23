import { esc, layout, type TemplateRenderer } from "./layout";

export const passwordReset: TemplateRenderer = (data) =>
  layout({
    title: "Password Reset Request",
    body: `
      <p>Dear ${esc(data.name || "User")},</p>
      <p>We received a request to reset your password. Click the button below to create a new password:</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${esc(data.resetUrl)}" class="button">Reset Password</a>
      </p>
      <p>This link will expire in 1 hour.</p>
      <p>If you did not request a password reset, please ignore this email.</p>
    `,
  });
