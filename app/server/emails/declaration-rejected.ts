import { esc, layout, type TemplateRenderer } from "./layout";
import { BRAND_COLORS } from "~/server/utils/branding";

export const declarationRejected: TemplateRenderer = (data) =>
  layout({
    title: "Declaration Requires Attention",
    headerColor: BRAND_COLORS.danger,
    body: `
      <p>Dear ${esc(data.name || "User")},</p>
      <p>Your asset declaration could not be approved at this time.</p>
      <p><strong>Declaration Code:</strong> ${esc(data.uniqueCode)}</p>
      <p><strong>Reason:</strong></p>
      <p style="padding: 15px; background: #fef2f2; border-left: 4px solid ${BRAND_COLORS.danger};">${esc(data.rejectionReason)}</p>
      <p>A new unique code will be issued for you to submit a corrected declaration.</p>
      <p>If you have questions, please contact our support team.</p>
    `,
  });
