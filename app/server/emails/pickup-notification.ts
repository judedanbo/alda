import { layout, type TemplateRenderer } from "./layout";

export const pickupNotification: TemplateRenderer = (data) =>
  layout({
    title: "Pickup Notification",
    body: `
      <p>Dear ${data.name || "User"},</p>
      <p>Your sealed asset declaration document is ready for pickup.</p>
      <p><strong>Declaration Code:</strong> ${data.uniqueCode}</p>
      <p><strong>Receipt Number:</strong> ${data.receiptNumber}</p>
      <hr style="margin: 20px 0;">
      <p><strong>Pickup Details:</strong></p>
      <p>Please bring a valid Ghana Card for identification when collecting your document.</p>
      ${data.authorizedPerson
        ? `<p><strong>Authorized Person:</strong> ${data.authorizedPerson} (${data.authorizedPhone})</p>`
        : ""}
    `,
  });
