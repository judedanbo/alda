/**
 * Centralised branding constants — names, colours, sender ids.
 *
 * Email templates, SMS templates, and PDF receipts all reach in here
 * instead of hard-coding strings so a rebrand or colour change is a
 * single-file edit.
 */

export const BRAND = {
  /** Long-form product name (used in email headers, contact pages). */
  fullName: "Asset Declaration Portal",
  /** Short product name (used in SMS bodies). */
  shortName: "ADLA",
  /** Owning entity for footers. */
  organization: "Republic of Ghana - Asset Declaration System",
  /** Constitutional authority line shown on receipts and select emails. */
  constitutionalAuthority: "Article 286(5) of the 1992 Constitution",
} as const;

export const BRAND_COLORS = {
  /** Primary Ghana green. */
  primary: "#006B3F",
  /** Lighter background tint of primary. */
  primaryTint: "#e8f5e9",
  /** Success/approved accent. */
  success: "#16A34A",
  /** Error/rejected accent. */
  danger: "#DC2626",
  /** Warning/on-hold accent. */
  warning: "#EA580C",
  /** Information/more-info accent. */
  info: "#2563EB",
} as const;

/**
 * Default SMS sender id (operator can override per provider via env).
 */
export const DEFAULT_SMS_SENDER_ID = "ADLA";
