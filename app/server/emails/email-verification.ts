import { layout, type TemplateRenderer } from "./layout";

export const emailVerification: TemplateRenderer = (data) =>
  layout({
    title: "Verify Your Email",
    body: `
      <p>Dear ${data.name || "User"},</p>
      <p>Please click the button below to verify your email address:</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${data.verificationUrl}" class="button">Verify Email</a>
      </p>
      <p>This link will expire in 24 hours.</p>
      <p>If you did not create an account, please ignore this email.</p>
    `,
  });
