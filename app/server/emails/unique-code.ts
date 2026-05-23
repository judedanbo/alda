import { esc, layout, type TemplateRenderer } from "./layout";

export const uniqueCode: TemplateRenderer = (data) =>
  layout({
    title: "Your Unique Declaration Code",
    includeConstitutionRef: true,
    body: `
      <p>Dear ${esc(data.name || "User")},</p>
      <p>Your asset declaration has been received. Your unique code is:</p>
      <div class="code">${esc(data.uniqueCode)}</div>
      <p><strong>Important:</strong> Please keep this code safe. You will need it to:</p>
      <ul>
        <li>Track the status of your declaration</li>
        <li>Collect your receipt after approval</li>
        <li>Reference your declaration in any correspondence</li>
      </ul>
      <p>You can check your declaration status at any time by logging into your account.</p>
    `,
  });
