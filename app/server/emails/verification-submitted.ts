import { esc, layout, type TemplateRenderer } from "./layout";

export const verificationSubmitted: TemplateRenderer = (data) =>
  layout({
    title: "Registration Under Review",
    body: `
      <p>Dear ${esc(data.name || "User")},</p>
      <p>Your registration is now being reviewed by our legal office. This process typically takes 1-3 business days.</p>
      <p>You will be notified once a decision has been made. You can check your verification status at any time by logging into your account.</p>
    `,
  });
