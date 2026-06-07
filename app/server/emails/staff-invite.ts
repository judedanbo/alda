import { esc, layout, type TemplateRenderer } from "./layout";

export const staffInvite: TemplateRenderer = (data) =>
  layout({
    title: "Activate your ADLA staff account",
    body: `
      <p>Dear ${esc(data.name || "Colleague")},</p>
      <p>An administrator has created an ADLA account for you with the following role(s): <strong>${esc(data.roleLabels || "Staff")}</strong>.</p>
      <p>Click the button below to verify your email and set your password:</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${esc(data.inviteUrl)}" class="button">Activate Account</a>
      </p>
      <p>This link will expire in 72 hours. If it has expired, ask an administrator to resend your invitation.</p>
      <p>If you were not expecting this email, please ignore it.</p>
    `,
  });
