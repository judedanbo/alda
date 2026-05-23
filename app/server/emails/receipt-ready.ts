import { esc, layout, type TemplateRenderer } from "./layout";

export const receiptReady: TemplateRenderer = (data) =>
  layout({
    title: "Receipt Ready",
    body: `
      <p>Dear ${esc(data.name || "User")},</p>
      <p>Your asset declaration receipt is now ready.</p>
      <p><strong>Receipt Number:</strong> ${esc(data.receiptNumber)}</p>
      <p><strong>Declaration Code:</strong> ${esc(data.uniqueCode)}</p>
      <p>You can download a copy of your receipt from your account dashboard.</p>
    `,
  });
