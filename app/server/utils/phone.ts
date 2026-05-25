const GHANA_PHONE_REGEX = /^(\+233|0)[2-9]\d{8}$/;
// E.164: leading `+`, country code 1-9, total 8–15 digits (incl. the cc digit).
const E164_REGEX = /^\+[1-9]\d{6,14}$/;

function strip(phone: string): string {
  return phone.trim().replace(/[\s().-]+/g, "");
}

export function normalizeGhanaPhone(phone: string): string {
  const trimmed = strip(phone);
  if (trimmed.startsWith("0")) {
    return `+233${trimmed.slice(1)}`;
  }
  return trimmed;
}

export function isValidGhanaPhone(phone: string): boolean {
  return GHANA_PHONE_REGEX.test(strip(phone));
}

export function ghanaPhoneAlternates(phone: string): string[] {
  const normalized = normalizeGhanaPhone(phone);
  if (!normalized.startsWith("+233")) return [normalized];
  return [normalized, `0${normalized.slice(4)}`];
}

/**
 * Looser, international-aware normalizer used for non-Ghana numbers and
 * for the registration / SMS-verification gate. Accepts:
 *   - Ghana local form `0…` → promoted to `+233…`
 *   - E.164 like `+14155551234`
 *   - Friendly formatting (spaces, dashes, parens) is stripped first
 * Returns the canonical E.164 string, or `null` if the input cannot be
 * coerced into a valid E.164 number.
 */
export function normalizePhoneE164(input: string): string | null {
  if (!input) return null;
  const trimmed = strip(input);
  if (!trimmed) return null;

  // Bare local Ghana number → promote. This is the only "fix up" we do
  // automatically; for any other country the user must supply the `+`,
  // since a bare digit string is ambiguous between a national format
  // and a country-code-prefixed E.164 with no `+`.
  if (/^0[2-9]\d{8}$/.test(trimmed)) {
    return `+233${trimmed.slice(1)}`;
  }

  return E164_REGEX.test(trimmed) ? trimmed : null;
}

export function isE164Phone(phone: string): boolean {
  return normalizePhoneE164(phone) !== null;
}

/** True iff the number, once normalized, is in the +233 country code. */
export function isGhanaPhone(phone: string): boolean {
  const normalized = normalizePhoneE164(phone);
  return !!normalized && normalized.startsWith("+233");
}
