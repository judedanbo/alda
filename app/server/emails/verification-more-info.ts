import { esc, layout, type TemplateRenderer } from "./layout";
import { BRAND_COLORS } from "~/server/utils/branding";

export const verificationMoreInfo: TemplateRenderer = (data) =>
  layout({
    title: "Additional Information Required",
    headerColor: BRAND_COLORS.info,
    body: `
      <p>Dear ${esc(data.name || "User")},</p>
      <p>The legal office requires additional information to complete your registration verification.</p>
      <p><strong>Request:</strong></p>
      <p style="padding: 15px; background: #f0f9ff; border-left: 4px solid ${BRAND_COLORS.info};">${esc(data.messageToApplicant)}</p>
      <p>Please update your profile with the requested information and resubmit for verification.</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${esc(data.dashboardUrl)}" class="button">Update Profile</a>
      </p>
    `,
  });
