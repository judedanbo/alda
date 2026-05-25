import { esc, layout, type TemplateRenderer } from "./layout";
import { BRAND_COLORS } from "~/server/utils/branding";

export const declarationApproved: TemplateRenderer = (data) =>
  layout({
    title: "Declaration Approved",
    headerColor: BRAND_COLORS.success,
    body: `
      <p>Dear ${esc(data.name || "User")},</p>
      <p>Congratulations! Your asset declaration has been <strong>approved</strong>.</p>
      <p><strong>Declaration Code:</strong> ${esc(data.uniqueCode)}</p>
      <p><strong>Approved:</strong> ${esc(data.approvedAt)}</p>
      <p>Your receipt is now ready for collection. You will receive a separate notification with pickup details.</p>
    `,
  });
