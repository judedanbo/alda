import { esc, layout, type TemplateRenderer } from "./layout";
import { BRAND } from "~/server/utils/branding";

export const welcome: TemplateRenderer = (data) =>
  layout({
    title: `Welcome to ${BRAND.fullName}`,
    includeConstitutionRef: true,
    body: `
      <p>Dear ${esc(data.name || "User")},</p>
      <p>Welcome to the Ghana ${BRAND.fullName}. Your account has been successfully created.</p>
      <p>You can now log in and complete your profile to start submitting your asset declarations.</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${esc(data.loginUrl)}" class="button">Login to Your Account</a>
      </p>
      <p>If you have any questions, please contact our support team.</p>
    `,
  });
