import { layout, type TemplateRenderer } from "./layout";

export const declarationApproved: TemplateRenderer = (data) =>
  layout({
    title: "Declaration Approved",
    headerColor: "#16A34A",
    body: `
      <p>Dear ${data.name || "User"},</p>
      <p>Congratulations! Your asset declaration has been <strong>approved</strong>.</p>
      <p><strong>Declaration Code:</strong> ${data.uniqueCode}</p>
      <p><strong>Approved:</strong> ${data.approvedAt}</p>
      <p>Your receipt is now ready for collection. You will receive a separate notification with pickup details.</p>
    `,
  });
