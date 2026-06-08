/**
 * Notification credential resolution.
 *
 * Every credential the email/SMS services read (SMTP user/pass, SMS provider
 * API keys, …) resolves through here: a DB-stored override (encrypted at rest)
 * takes precedence, falling back to the existing env/runtimeConfig value, then
 * a built-in default. Admins set the DB overrides on the Notifications →
 * Settings tab; absence of a row means "use env".
 *
 * The DB values are AES-256-GCM encrypted via encryptPii()/decryptPii() — the
 * key lives only in env (PII_ENCRYPTION_KEY), so a database dump alone never
 * exposes a secret. Secret fields are write-only: their plaintext is read here
 * at send time but never returned to clients (see getCredentialStatus).
 */
import prisma from "~/server/utils/prisma";
import { decryptPii } from "~/server/utils/pii-encryption";
import { DEFAULT_SMS_SENDER_ID } from "~/server/utils/branding";

export type CredentialGroup = "smtp" | "sms";

export interface CredentialField {
  key: string;
  group: CredentialGroup;
  label: string;
  /** Secret values are never returned to clients (write-only in the UI). */
  secret: boolean;
  kind: "text" | "number" | "select";
  options?: string[];
  /** The pre-existing env / runtimeConfig value used when no DB override exists. */
  envFallback: () => string;
}

export type CredentialSource = "db" | "env" | "unset";

export interface CredentialStatus {
  key: string;
  group: CredentialGroup;
  label: string;
  secret: boolean;
  kind: CredentialField["kind"];
  options?: string[];
  source: CredentialSource;
  /** Present for non-secret fields only — the effective value. Omitted for secrets. */
  value?: string;
}

export interface ResolvedSmsConfig {
  provider: "hubtel" | "arkesel";
  hubtel: { clientId: string; clientSecret: string; senderId: string };
  arkesel: { apiKey: string; senderId: string };
  twilio: { accountSid: string; authToken: string; fromNumber: string };
}

const smtp = () => useRuntimeConfig() as unknown as {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
};

/**
 * The registry — single source of truth for every credential field, its
 * secrecy, and where its env fallback comes from. SMTP fallbacks read
 * runtimeConfig (the NUXT_-prefixed twins); SMS fallbacks read process.env
 * exactly as sms.service did before this layer existed.
 */
export const CREDENTIAL_FIELDS: CredentialField[] = [
  // Email (SMTP)
  { key: "smtp.host", group: "smtp", label: "SMTP host", secret: false, kind: "text", envFallback: () => String(smtp().smtpHost ?? "") },
  { key: "smtp.port", group: "smtp", label: "SMTP port", secret: false, kind: "number", envFallback: () => String(smtp().smtpPort ?? "") },
  { key: "smtp.user", group: "smtp", label: "SMTP username", secret: true, kind: "text", envFallback: () => smtp().smtpUser ?? "" },
  { key: "smtp.pass", group: "smtp", label: "SMTP password", secret: true, kind: "text", envFallback: () => smtp().smtpPass ?? "" },
  { key: "smtp.from", group: "smtp", label: "From address", secret: false, kind: "text", envFallback: () => smtp().smtpFrom ?? "" },

  // SMS — provider selector + per-provider credentials
  { key: "sms.provider", group: "sms", label: "Primary SMS provider", secret: false, kind: "select", options: ["hubtel", "arkesel"], envFallback: () => (process.env.SMS_PROVIDER === "arkesel" ? "arkesel" : "hubtel") },
  { key: "sms.arkesel.apiKey", group: "sms", label: "Arkesel API key", secret: true, kind: "text", envFallback: () => process.env.ARKESEL_API_KEY ?? "" },
  { key: "sms.arkesel.senderId", group: "sms", label: "Arkesel sender ID", secret: false, kind: "text", envFallback: () => process.env.ARKESEL_SENDER_ID || DEFAULT_SMS_SENDER_ID },
  { key: "sms.hubtel.clientId", group: "sms", label: "Hubtel client ID", secret: true, kind: "text", envFallback: () => process.env.HUBTEL_CLIENT_ID ?? "" },
  { key: "sms.hubtel.clientSecret", group: "sms", label: "Hubtel client secret", secret: true, kind: "text", envFallback: () => process.env.HUBTEL_CLIENT_SECRET ?? "" },
  { key: "sms.hubtel.senderId", group: "sms", label: "Hubtel sender ID", secret: false, kind: "text", envFallback: () => process.env.HUBTEL_SENDER_ID || DEFAULT_SMS_SENDER_ID },
  { key: "sms.twilio.accountSid", group: "sms", label: "Twilio account SID", secret: true, kind: "text", envFallback: () => process.env.SMS_TWILIO_ACCOUNT_SID ?? "" },
  { key: "sms.twilio.authToken", group: "sms", label: "Twilio auth token", secret: true, kind: "text", envFallback: () => process.env.SMS_TWILIO_AUTH_TOKEN ?? "" },
  { key: "sms.twilio.fromNumber", group: "sms", label: "Twilio from number", secret: false, kind: "text", envFallback: () => process.env.SMS_TWILIO_FROM_NUMBER ?? "" },
  { key: "sms.webhookSecret", group: "sms", label: "SMS webhook secret", secret: true, kind: "text", envFallback: () => process.env.NOTIFICATIONS_SMS_WEBHOOK_SECRET ?? "" },
];

export const FIELD_BY_KEY = new Map(CREDENTIAL_FIELDS.map((f) => [f.key, f]));
export const isCredentialKey = (key: string): boolean => FIELD_BY_KEY.has(key);

// In-memory cache of decrypted DB overrides. TTL keeps a hot path off the DB;
// invalidateCredentialCache() gives same-pod immediacy after a write, and
// cross-pod deployments converge within CACHE_TTL_MS.
const CACHE_TTL_MS = 30_000;
let cache: { map: Map<string, string>; at: number } | null = null;

export function invalidateCredentialCache(): void {
  cache = null;
}

async function loadDbOverrides(): Promise<Map<string, string>> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.map;
  const rows = await prisma.notificationCredential.findMany();
  const map = new Map<string, string>();
  for (const row of rows) {
    try {
      map.set(row.key, decryptPii(row.valueCipher));
    } catch (err) {
      // A row we can't decrypt (e.g. key rotation gap) must not break sending —
      // fall through to the env value for that key.
      console.error(`[notification-config] failed to decrypt credential ${row.key}`, err);
    }
  }
  cache = { map, at: Date.now() };
  return map;
}

/** Resolve a single credential: DB override (non-empty) → env fallback → "". */
export async function getCredential(key: string): Promise<string> {
  const overrides = await loadDbOverrides();
  const dbVal = overrides.get(key);
  if (dbVal != null && dbVal !== "") return dbVal;
  return FIELD_BY_KEY.get(key)?.envFallback() ?? "";
}

export async function getResolvedEmailConfig(): Promise<{
  host: string; port: number; user: string; pass: string; from: string;
}> {
  const [host, portStr, user, pass, from] = await Promise.all([
    getCredential("smtp.host"),
    getCredential("smtp.port"),
    getCredential("smtp.user"),
    getCredential("smtp.pass"),
    getCredential("smtp.from"),
  ]);
  const port = Number.parseInt(portStr, 10);
  return { host, port: Number.isFinite(port) ? port : 587, user, pass, from };
}

export async function getResolvedSmsConfig(): Promise<ResolvedSmsConfig> {
  const [
    provider, arkKey, arkSender,
    hubId, hubSecret, hubSender,
    twSid, twToken, twFrom,
  ] = await Promise.all([
    getCredential("sms.provider"),
    getCredential("sms.arkesel.apiKey"),
    getCredential("sms.arkesel.senderId"),
    getCredential("sms.hubtel.clientId"),
    getCredential("sms.hubtel.clientSecret"),
    getCredential("sms.hubtel.senderId"),
    getCredential("sms.twilio.accountSid"),
    getCredential("sms.twilio.authToken"),
    getCredential("sms.twilio.fromNumber"),
  ]);
  return {
    provider: provider === "arkesel" ? "arkesel" : "hubtel",
    hubtel: { clientId: hubId, clientSecret: hubSecret, senderId: hubSender || DEFAULT_SMS_SENDER_ID },
    arkesel: { apiKey: arkKey, senderId: arkSender || DEFAULT_SMS_SENDER_ID },
    twilio: { accountSid: twSid, authToken: twToken, fromNumber: twFrom },
  };
}

/**
 * Per-field status for the admin UI. Reports the resolution source and, for
 * NON-secret fields only, the effective value. Secret values are never
 * included — the UI shows status + a write-only input instead.
 */
export async function getCredentialStatus(): Promise<CredentialStatus[]> {
  const overrides = await loadDbOverrides();
  return CREDENTIAL_FIELDS.map((f) => {
    const dbVal = overrides.get(f.key);
    const hasDb = dbVal != null && dbVal !== "";
    const envVal = f.envFallback();
    const hasEnv = envVal != null && envVal !== "";
    const source: CredentialSource = hasDb ? "db" : hasEnv ? "env" : "unset";
    const base: CredentialStatus = {
      key: f.key, group: f.group, label: f.label, secret: f.secret, kind: f.kind, options: f.options, source,
    };
    if (f.secret) return base; // never expose the value
    return { ...base, value: hasDb ? dbVal : hasEnv ? envVal : "" };
  });
}
