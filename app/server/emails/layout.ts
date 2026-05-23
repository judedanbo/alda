/**
 * Shared email layout and styling.
 *
 * Templates compose a body fragment and pass it to `layout()` along with
 * an optional header colour (defaulting to Ghana green #006B3F). The
 * footer is added automatically.
 */

export const BASE_STYLES = `
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #006B3F; color: white; padding: 20px; text-align: center; }
    .content { padding: 30px 20px; background-color: #f9f9f9; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
    .button { display: inline-block; padding: 12px 24px; background-color: #006B3F; color: white; text-decoration: none; border-radius: 4px; }
    .code { font-size: 24px; font-weight: bold; color: #006B3F; letter-spacing: 2px; padding: 20px; background: #e8f5e9; text-align: center; margin: 20px 0; }
  </style>
`;

export interface LayoutOptions {
  title: string;
  body: string;
  headerColor?: string;
  /** Whether to include the constitutional reference line in the footer. */
  includeConstitutionRef?: boolean;
}

export function layout({ title, body, headerColor, includeConstitutionRef = false }: LayoutOptions): string {
  const headerStyle = headerColor ? ` style="background-color: ${headerColor};"` : "";
  const constitutionLine = includeConstitutionRef
    ? `<p>Article 286(5) of the 1992 Constitution</p>`
    : "";
  return `
    ${BASE_STYLES}
    <div class="container">
      <div class="header"${headerStyle}>
        <h1>${title}</h1>
      </div>
      <div class="content">
        ${body}
      </div>
      <div class="footer">
        <p>Republic of Ghana - Asset Declaration System</p>
        ${constitutionLine}
      </div>
    </div>
  `;
}

export type TemplateRenderer = (data: Record<string, unknown>) => string;
