import { layout, type TemplateRenderer } from "./layout";

export const verificationApproved: TemplateRenderer = (data) =>
  layout({
    title: "Registration Verified",
    headerColor: "#16A34A",
    body: `
      <p>Dear ${data.name || "User"},</p>
      <p>Congratulations! Your registration has been <strong>verified</strong> by the legal office.</p>
      <p>You can now create and submit asset declarations through your dashboard.</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${data.dashboardUrl}" class="button">Go to Dashboard</a>
      </p>
    `,
  });
