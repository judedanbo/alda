/**
 * Shared email layout and styling.
 *
 * Templates compose a body fragment and pass it to `layout()` along with
 * an optional header colour (defaulting to Ghana green from BRAND_COLORS).
 * The footer is added automatically.
 *
 * **Always interpolate user-derived data through `esc()`.** Rejection
 * reasons, reviewer messages, applicant names, and office names all
 * originate from typed-in user input and would otherwise inject HTML
 * straight into the rendered email body.
 */
import { BRAND, BRAND_COLORS } from "~/server/utils/branding";

/**
 * HTML-escape a value for safe interpolation in both element text and
 * attribute contexts (escaping `&`, `<`, `>`, `"`, `'`).
 *
 * `null` / `undefined` render as the empty string so missing optional
 * fields don't show as literal "undefined".
 */
export function esc(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const BASE_STYLES = `
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: ${BRAND_COLORS.primary}; color: white; padding: 20px; text-align: center; }
    .content { padding: 30px 20px; background-color: #f9f9f9; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
    .button { display: inline-block; padding: 12px 24px; background-color: ${BRAND_COLORS.primary}; color: white; text-decoration: none; border-radius: 4px; }
    .code { font-size: 24px; font-weight: bold; color: ${BRAND_COLORS.primary}; letter-spacing: 2px; padding: 20px; background: ${BRAND_COLORS.primaryTint}; text-align: center; margin: 20px 0; }
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
  // headerColor is template-controlled (not user input) and only ever
  // sourced from BRAND_COLORS — no escape needed. title is template-
  // controlled too but we escape it defensively in case a future
  // template threads user input into it.
  const headerStyle = headerColor ? ` style="background-color: ${headerColor};"` : "";
  const constitutionLine = includeConstitutionRef
    ? `<p>${BRAND.constitutionalAuthority}</p>`
    : "";
  return `
    ${BASE_STYLES}
    <div class="container">
      <div class="header"${headerStyle}>
        <h1>${esc(title)}</h1>
      </div>
      <div class="content">
        ${body}
      </div>
      <div class="footer">
        <p>${BRAND.organization}</p>
        ${constitutionLine}
      </div>
    </div>
  `;
}

export type TemplateRenderer = (data: Record<string, unknown>) => string;
