import { esc, layout, type TemplateRenderer } from "./layout";
import { BRAND_COLORS } from "~/server/utils/branding";

export const verificationApproved: TemplateRenderer = (data) =>
  layout({
    title: "Registration Verified",
    headerColor: BRAND_COLORS.success,
    body: `
      <p>Dear ${esc(data.name || "User")},</p>
      <p>Congratulations! Your registration has been <strong>verified</strong> by the legal office.</p>
      <p>You can now create and submit asset declarations through your dashboard.</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${esc(data.dashboardUrl)}" class="button">Go to Dashboard</a>
      </p>
    `,
  });
