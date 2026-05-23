import { layout, type TemplateRenderer } from "./layout";
import { BRAND_COLORS } from "~/server/utils/branding";

export const verificationRejected: TemplateRenderer = (data) =>
  layout({
    title: "Registration Not Approved",
    headerColor: BRAND_COLORS.danger,
    body: `
      <p>Dear ${data.name || "User"},</p>
      <p>Your registration could not be approved at this time.</p>
      <p><strong>Reason:</strong></p>
      <p style="padding: 15px; background: #fef2f2; border-left: 4px solid ${BRAND_COLORS.danger};">${data.reason}</p>
      ${data.messageToApplicant
        ? `<p><strong>Message from reviewer:</strong></p><p style="padding: 15px; background: #f0f9ff; border-left: 4px solid ${BRAND_COLORS.info};">${data.messageToApplicant}</p>`
        : ""}
      <p>You can update your profile and resubmit for verification through your dashboard.</p>
    `,
  });
