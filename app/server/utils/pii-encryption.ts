/**
 * Field-level encryption for personally-identifying numeric IDs stored in
 * `applicant_profiles` (Ghana Card numbers, alternate-ID numbers).
 *
 * Two keys:
 *
 * - `PII_ENCRYPTION_KEY` — 32 raw bytes hex-encoded (64 chars). AES-256-GCM
 *   key. Used for the cipher envelope on each row.
 * - `PII_HMAC_KEY` — 32 raw bytes hex-encoded. HMAC-SHA256 key. Used to
 *   produce a deterministic hash column for equality / uniqueness queries
 *   (the plaintext column had a unique index that we can't preserve once
 *   the ciphertext is random per row).
 *
 * Cipher envelope format: `v<n>.<iv-hex>.<authTag-hex>.<ciphertext-hex>`.
 * The version prefix lets a future PII_ENCRYPTION_KEY rotation add a `v2`
 * value without breaking decryption of pre-rotation rows. `decryptPii`
 * still rejects unknown versions today; the rotation PR will register the
 * new key here.
 *
 * Both keys are validated at server boot by `server/utils/config-validation`
 * — production won't start if either is missing or set to the committed
 * dev fallback.
 */

import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

const CURRENT_VERSION = 1;
const ALGO = "aes-256-gcm";
const IV_BYTES = 12; // AES-GCM standard nonce size

function readKey(envVar: string, label: string): Buffer {
  const hex = process.env[envVar];
  if (!hex || hex.length === 0) {
    throw new Error(`${envVar} is not set; ${label} cannot be performed`);
  }
  if (hex.length !== 64) {
    throw new Error(`${envVar} must be 32 raw bytes hex-encoded (64 hex characters)`);
  }
  return Buffer.from(hex, "hex");
}

/**
 * Normalize an ID number into the form HMAC will see. The validators force
 * uppercase + trimmed input at write time; this function is the single
 * place that says "we canonicalise the same way at hash time as at lookup
 * time". Any future tweak (e.g. dropping internal whitespace) goes here.
 */
export function canonicalizeId(value: string): string {
  return value.trim().toUpperCase();
}

/** Encrypt a national-ID-style string. Returns the envelope to store. */
export function encryptPii(plaintext: string): string {
  const key = readKey("PII_ENCRYPTION_KEY", "encryption");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v${CURRENT_VERSION}.${iv.toString("hex")}.${tag.toString("hex")}.${ct.toString("hex")}`;
}

/** Reverse `encryptPii`. Throws on a tampered or unknown-version envelope. */
export function decryptPii(envelope: string): string {
  if (!envelope) throw new Error("Cannot decrypt an empty envelope");
  const parts = envelope.split(".");
  if (parts.length !== 4 || !parts[0]!.startsWith("v")) {
    throw new Error("Invalid PII cipher envelope shape");
  }
  const version = Number.parseInt(parts[0]!.slice(1), 10);
  if (version !== CURRENT_VERSION) {
    throw new Error(`Unsupported PII cipher version: v${version}`);
  }
  const iv = Buffer.from(parts[1]!, "hex");
  const tag = Buffer.from(parts[2]!, "hex");
  const ct = Buffer.from(parts[3]!, "hex");
  const key = readKey("PII_ENCRYPTION_KEY", "decryption");
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

/**
 * Deterministic HMAC over the canonicalised plaintext. Use this as the
 * value of the `*Hash` columns (which carry the unique index) and as the
 * lookup key for equality queries.
 */
export function hashPii(value: string): string {
  const key = readKey("PII_HMAC_KEY", "hashing");
  return createHmac("sha256", key).update(canonicalizeId(value)).digest("hex");
}

/**
 * Convenience: decrypt the cipher fields on a profile snapshot and
 * rehydrate them under the legacy `ghanaCardNumber` / `alternateIdNumber`
 * keys, so API responses keep their existing JSON shape. Callers pass the
 * row straight from Prisma (which exposes `*Cipher` / `*Hash` columns) and
 * spread the result into the response.
 */
export interface ProfileCipherFields {
  ghanaCardNumberCipher: string | null;
  alternateIdNumberCipher: string | null;
}

export function decryptProfileIds<T extends ProfileCipherFields>(
  profile: T,
): T & { ghanaCardNumber: string | null; alternateIdNumber: string | null } {
  return {
    ...profile,
    ghanaCardNumber: profile.ghanaCardNumberCipher ? decryptPii(profile.ghanaCardNumberCipher) : null,
    alternateIdNumber: profile.alternateIdNumberCipher ? decryptPii(profile.alternateIdNumberCipher) : null,
  };
}
