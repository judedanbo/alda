import { layout, type TemplateRenderer } from "./layout";

export const declarationRejected: TemplateRenderer = (data) =>
  layout({
    title: "Declaration Requires Attention",
    headerColor: "#DC2626",
    body: `
      <p>Dear ${data.name || "User"},</p>
      <p>Your asset declaration could not be approved at this time.</p>
      <p><strong>Declaration Code:</strong> ${data.uniqueCode}</p>
      <p><strong>Reason:</strong></p>
      <p style="padding: 15px; background: #fef2f2; border-left: 4px solid #DC2626;">${data.rejectionReason}</p>
      <p>A new unique code will be issued for you to submit a corrected declaration.</p>
      <p>If you have questions, please contact our support team.</p>
    `,
  });
