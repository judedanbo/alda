import { layout, type TemplateRenderer } from "./layout";

export const verificationMoreInfo: TemplateRenderer = (data) =>
  layout({
    title: "Additional Information Required",
    headerColor: "#2563EB",
    body: `
      <p>Dear ${data.name || "User"},</p>
      <p>The legal office requires additional information to complete your registration verification.</p>
      <p><strong>Request:</strong></p>
      <p style="padding: 15px; background: #f0f9ff; border-left: 4px solid #2563EB;">${data.messageToApplicant}</p>
      <p>Please update your profile with the requested information and resubmit for verification.</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${data.dashboardUrl}" class="button">Update Profile</a>
      </p>
    `,
  });
