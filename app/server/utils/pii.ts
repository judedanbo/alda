/**
 * Masking helpers for personally-identifying values written to audit logs,
 * exports, and any other surface where the raw value shouldn't appear.
 *
 * Maskers preserve enough of the original to be useful for correlation
 * (last digits, initials, domain) without leaking the full value.
 *
 * The compatible inverse — encryption-at-rest in the source columns — is
 * tracked separately (see docs/security-assessment.md, C-5 follow-up).
 */

/** Mask a Ghana Card number (`GHA-NNNNNNNNN-N`) keeping the trailing check digit. */
export function maskGhanaCard(value: string | null | undefined): string {
  if (!value) return "";
  const m = /^GHA-(\d{9})-(\d)$/.exec(value);
  if (!m) return "GHA-XXXXXXXXX-X";
  return `GHA-XXXXXXXXX-${m[2]}`;
}

/** Mask an alternate-ID number: keep the first character, mask the rest. */
export function maskAlternateId(value: string | null | undefined): string {
  if (!value) return "";
  if (value.length <= 1) return "*";
  return value[0]! + "*".repeat(value.length - 1);
}

/** Mask an email: keep the first character of the local part + the domain. */
export function maskEmail(value: string | null | undefined): string {
  if (!value) return "";
  const at = value.lastIndexOf("@");
  if (at <= 0 || at === value.length - 1) return "***";
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (local.length <= 1) return `${local}***@${domain}`;
  return `${local[0]}${"*".repeat(Math.max(3, local.length - 1))}@${domain}`;
}

/**
 * Mask a phone number: keep the first two characters (the leading `+` plus
 * one digit) and the last two digits, mask everything in between. The exact
 * country-code length isn't preserved — it varies (`+1` US vs `+233` GH) and
 * audit forensics doesn't need it.
 */
export function maskPhone(value: string | null | undefined): string {
  if (!value) return "";
  if (value.length <= 4) return "*".repeat(value.length);
  return value.slice(0, 2) + "*".repeat(value.length - 4) + value.slice(-2);
}

/** Mask a full name: preserve initials. `"John Doe"` → `"J*** D**"`. */
export function maskFullName(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]! + "*".repeat(Math.max(1, part.length - 1)))
    .join(" ");
}

/** Mask a MinIO bucket key by collapsing UUID segments to `<redacted>`. */
export function maskBucketKey(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .split("?")[0]!
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<redacted>");
}

/**
 * Field-name → masker registry. Used by `scrubAuditValues` to redact known
 * PII fields by name. Field names mirror the Prisma column names in
 * `applicant_profiles` and `users` plus the upload-key columns.
 */
const AUDIT_PII_MASKERS: Record<string, (v: unknown) => unknown> = {
  fullName: (v) => maskFullName(String(v)),
  ghanaCardNumber: (v) => maskGhanaCard(String(v)),
  alternateIdNumber: (v) => maskAlternateId(String(v)),
  email: (v) => maskEmail(String(v)),
  phone: (v) => maskPhone(String(v)),
  ghanaCardFrontUrl: (v) => maskBucketKey(String(v)),
  ghanaCardBackUrl: (v) => maskBucketKey(String(v)),
  alternateIdScanUrl: (v) => maskBucketKey(String(v)),
  letterScanUrl: (v) => maskBucketKey(String(v)),
};

/**
 * Return a copy of `values` with known PII fields replaced by masked
 * placeholders. Unknown fields pass through unchanged. `null` and
 * `undefined` are preserved as-is so callers can still tell the difference
 * between "field absent" and "field cleared". Shallow only — audit-log
 * value objects are flat by convention in this codebase.
 */
export function scrubAuditValues(
  values: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!values) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(values)) {
    if (val === null || val === undefined) {
      out[key] = val;
      continue;
    }
    const masker = AUDIT_PII_MASKERS[key];
    out[key] = masker ? masker(val) : val;
  }
  return out;
}
