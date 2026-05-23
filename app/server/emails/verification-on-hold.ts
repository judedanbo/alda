import { layout, type TemplateRenderer } from "./layout";
import { BRAND_COLORS } from "~/server/utils/branding";

export const verificationOnHold: TemplateRenderer = (data) =>
  layout({
    title: "Registration Under Investigation",
    headerColor: BRAND_COLORS.warning,
    body: `
      <p>Dear ${data.name || "User"},</p>
      <p>Your registration has been placed on hold for further review.</p>
      <p><strong>Reason:</strong></p>
      <p style="padding: 15px; background: #fff7ed; border-left: 4px solid ${BRAND_COLORS.warning};">${data.reason}</p>
      <p>Please wait for further updates. You will be notified once a final decision is made.</p>
    `,
  });
