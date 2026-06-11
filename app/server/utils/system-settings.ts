/**
 * System setting resolution.
 *
 * Global behaviour toggles that an admin can flip at runtime (Admin →
 * Settings) without a redeploy. Every setting resolves through here: a
 * DB-stored override takes precedence, falling back to the existing
 * env/runtimeConfig value. Absence of a row means "use env", so a deployment's
 * environment / configmap remains the source of truth until an admin
 * deliberately overrides it.
 *
 * These are NON-secret operational flags (unlike NotificationCredential, which
 * holds encrypted connection secrets), so values are stored in plaintext. The
 * stored string is the raw representation — "true"/"false" for booleans, the
 * integer for numbers — and is coerced on read by each field's `coerce`.
 */
import prisma from "~/server/utils/prisma";

export type SettingKind = "boolean" | "number";
export type SettingValue = boolean | number;

export interface SettingField<T extends SettingValue = SettingValue> {
  key: string;
  /** Maps to the underlying env var, surfaced in the UI for operators. */
  envVar: string;
  label: string;
  description: string;
  kind: SettingKind;
  /** The pre-existing env / runtimeConfig value used when no DB override exists. */
  envFallback: () => T;
  /** Coerce a stored DB string into the typed value; null = invalid, ignore the row. */
  coerce: (raw: string) => T | null;
  /** For numbers: inclusive bounds enforced on write. */
  min?: number;
  max?: number;
}

export type SettingSource = "db" | "env";

export interface SettingStatus {
  key: string;
  envVar: string;
  label: string;
  description: string;
  kind: SettingKind;
  min?: number;
  max?: number;
  source: SettingSource;
  /** The effective (resolved) value, typed. */
  value: SettingValue;
}

const boolFromEnv = (v: string | undefined, fallback: boolean): boolean =>
  v == null || v === "" ? fallback : v === "true";

const coerceBool = (raw: string): boolean | null =>
  raw === "true" ? true : raw === "false" ? false : null;

const intFromEnv = (v: string | undefined, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};

const coerceInt = (raw: string): number | null => {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.floor(n) : null;
};

/**
 * The registry — single source of truth for every admin-managed global
 * setting, its kind, and where its env fallback comes from. Adding a flag here
 * (plus reading it via getSetting at the consuming site) is all that's needed
 * to expose it on the Admin → Settings page.
 */
export const SETTING_FIELDS: SettingField[] = [
  {
    key: "auth.requireEmailVerificationForLogin",
    envVar: "REQUIRE_EMAIL_VERIFICATION_FOR_LOGIN",
    label: "Require verified email to log in",
    description:
      "When on, accounts with an unverified email address are refused at login (403) until they follow the verification link.",
    kind: "boolean",
    envFallback: () => boolFromEnv(process.env.REQUIRE_EMAIL_VERIFICATION_FOR_LOGIN, false),
    coerce: coerceBool,
  },
  {
    key: "auth.requirePhoneVerificationForLogin",
    envVar: "REQUIRE_PHONE_VERIFICATION_FOR_LOGIN",
    label: "Require verified phone number to log in",
    description:
      "When on, accounts with an unverified phone number are refused at login (403) until they complete phone verification. Off by default allows logging in without phone verification.",
    kind: "boolean",
    envFallback: () => boolFromEnv(process.env.REQUIRE_PHONE_VERIFICATION_FOR_LOGIN, false),
    coerce: coerceBool,
  },
  {
    key: "security.cspEnforce",
    envVar: "SECURITY_CSP_ENFORCE",
    label: "Enforce Content-Security-Policy",
    description:
      "When on, the CSP is sent as an enforcing header instead of report-only. Enforce only after verifying the policy against the live asset surface, or the UI may break.",
    kind: "boolean",
    envFallback: () => boolFromEnv(process.env.SECURITY_CSP_ENFORCE, false),
    coerce: coerceBool,
  },
  {
    key: "notifications.rateLimitPerHour",
    envVar: "NOTIFICATIONS_RATE_LIMIT_PER_HOUR",
    label: "Notification rate limit (per user, per type, per hour)",
    description:
      "Runaway-bug fuse capping how many of the same notification type a single user receives in an hour. Security/transactional types (password reset, email verification) bypass this.",
    kind: "number",
    min: 1,
    max: 1000,
    envFallback: () => intFromEnv(process.env.NOTIFICATIONS_RATE_LIMIT_PER_HOUR, 10),
    coerce: coerceInt,
  },
];

export const SETTING_BY_KEY = new Map(SETTING_FIELDS.map((f) => [f.key, f]));
export const isSettingKey = (key: string): boolean => SETTING_BY_KEY.has(key);

// In-memory cache of DB overrides. TTL keeps the hot path (login, every
// response's security headers) off the DB; invalidateSettingsCache() gives
// same-pod immediacy after a write, and cross-pod deployments converge within
// CACHE_TTL_MS.
const CACHE_TTL_MS = 30_000;
let cache: { map: Map<string, string>; at: number } | null = null;

export function invalidateSettingsCache(): void {
  cache = null;
}

async function loadDbOverrides(): Promise<Map<string, string>> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.map;
  const rows = await prisma.systemSetting.findMany();
  const map = new Map<string, string>(rows.map((r) => [r.key, r.value]));
  cache = { map, at: Date.now() };
  return map;
}

/**
 * Resolve a single setting: valid DB override → env fallback. Returns the
 * typed value. Never throws on a bad DB row — it falls through to env so a
 * malformed override can't break login or response headers.
 */
export async function getSetting<T extends SettingValue = SettingValue>(key: string): Promise<T> {
  const field = SETTING_BY_KEY.get(key);
  if (!field) {
    throw new Error(`Unknown system setting key: ${key}`);
  }
  let overrides: Map<string, string>;
  try {
    overrides = await loadDbOverrides();
  } catch (err) {
    // DB unavailable — fail safe to the env value rather than the request.
    console.error("[system-settings] failed to load overrides; using env fallback", err);
    return field.envFallback() as T;
  }
  const raw = overrides.get(key);
  if (raw != null) {
    const coerced = field.coerce(raw);
    if (coerced != null) return coerced as T;
  }
  return field.envFallback() as T;
}

/**
 * Per-field status for the admin UI: the resolution source (db / env) and the
 * effective typed value for every registered setting.
 */
export async function getSettingsStatus(): Promise<SettingStatus[]> {
  let overrides: Map<string, string>;
  try {
    overrides = await loadDbOverrides();
  } catch {
    overrides = new Map();
  }
  return SETTING_FIELDS.map((f) => {
    const raw = overrides.get(f.key);
    const coerced = raw != null ? f.coerce(raw) : null;
    const hasDb = coerced != null;
    return {
      key: f.key,
      envVar: f.envVar,
      label: f.label,
      description: f.description,
      kind: f.kind,
      min: f.min,
      max: f.max,
      source: hasDb ? "db" : "env",
      value: hasDb ? coerced : f.envFallback(),
    };
  });
}
