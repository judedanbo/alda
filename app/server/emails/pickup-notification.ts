import { esc, layout, type TemplateRenderer } from "./layout";

export const pickupNotification: TemplateRenderer = (data) =>
  layout({
    title: "Pickup Notification",
    body: `
      <p>Dear ${esc(data.name || "User")},</p>
      <p>Your sealed asset declaration document is ready for pickup.</p>
      <p><strong>Declaration Code:</strong> ${esc(data.uniqueCode)}</p>
      <p><strong>Receipt Number:</strong> ${esc(data.receiptNumber)}</p>
      <hr style="margin: 20px 0;">
      <p><strong>Pickup Details:</strong></p>
      <p>Please bring a valid Ghana Card for identification when collecting your document.</p>
      ${data.authorizedPerson
        ? `<p><strong>Authorized Person:</strong> ${esc(data.authorizedPerson)} (${esc(data.authorizedPhone)})</p>`
        : ""}
    `,
  });
