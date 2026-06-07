import { createHmac, timingSafeEqual } from "node:crypto";

/** Default lifetime of a signed file URL (matches the old presign TTL). */
export const DEFAULT_FILE_URL_TTL_SECONDS = 900;

/** HMAC key — reuse the server JWT secret (one-way; cannot leak the JWT key). */
function signingSecret(): string {
  return useRuntimeConfig().jwtSecret as string;
}

/** Deterministic signature over the exact key + expiry. */
function computeSig(key: string, exp: number): string {
  return createHmac("sha256", signingSecret()).update(`${key}\n${exp}`).digest("hex");
}

/** URL-encode each path segment but keep "/" separators. */
function encodeKeyPath(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

/** Mint a same-origin, time-limited URL for a bucket-relative MinIO key. */
export function signFileUrl(key: string, ttlSeconds: number = DEFAULT_FILE_URL_TTL_SECONDS): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = computeSig(key, exp);
  return `/api/files/${encodeKeyPath(key)}?exp=${exp}&sig=${sig}`;
}

/** True only when `sig` matches `key`+`exp` and `exp` is still in the future. */
export function verifyFileSig(key: string, exp: number, sig: string): boolean {
  if (!Number.isInteger(exp) || exp <= Math.floor(Date.now() / 1000)) return false;
  if (typeof sig !== "string" || sig.length === 0) return false;
  const expected = Buffer.from(computeSig(key, exp), "hex");
  const provided = Buffer.from(sig, "hex");
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}
