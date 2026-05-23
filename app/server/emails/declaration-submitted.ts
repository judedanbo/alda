import { layout, type TemplateRenderer } from "./layout";

export const declarationSubmitted: TemplateRenderer = (data) =>
  layout({
    title: "Declaration Submitted",
    body: `
      <p>Dear ${data.name || "User"},</p>
      <p>Your asset declaration has been successfully submitted for review.</p>
      <p><strong>Declaration Code:</strong> ${data.uniqueCode}</p>
      <p><strong>Submitted:</strong> ${data.submittedAt}</p>
      <p>Our team will review your declaration and you will be notified once a decision is made.</p>
    `,
  });
