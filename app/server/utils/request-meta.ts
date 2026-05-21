import { createHash, randomUUID } from "node:crypto";
import type { H3Event } from "h3";

/**
 * Request metadata helpers shared by traffic capture, abuse scoring and rate
 * limiting: client-IP extraction, privacy-preserving IP transforms, geo
 * derivation, route-pattern normalisation and request ids.
 */

/**
 * Extracts the client IP. The header precedence mirrors `audit.ts` exactly
 * (`x-forwarded-for` first hop, then `x-real-ip`) so traffic events and audit
 * logs always agree; a socket fallback is added for robustness.
 */
export function extractClientIp(event: H3Event): string {
  const forwarded = getHeader(event, "x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;

  const real = getHeader(event, "x-real-ip");
  if (real) return real.trim();

  const socket = event.node?.req?.socket?.remoteAddress;
  if (socket) return socket;

  return "unknown";
}

/** Salted SHA-256 of an IP — the long-term, non-reversible identifier. */
export function hashIp(ip: string, salt: string): string {
  return createHash("sha256").update(`${ip}:${salt}`).digest("hex");
}

/**
 * Coarsens an IP for human-readable display: drops the last IPv4 octet or
 * keeps only the first three IPv6 hextets. Returns `null` for unknown input.
 */
export function truncateIp(ip: string): string | null {
  if (!ip || ip === "unknown") return null;

  if (ip.includes(".") && !ip.includes(":")) {
    const parts = ip.split(".");
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
    return null;
  }

  if (ip.includes(":")) {
    const groups = ip.split(":").filter(Boolean);
    if (groups.length >= 3) return `${groups.slice(0, 3).join(":")}::`;
    return null;
  }

  return null;
}

/** True for loopback / private / link-local ranges — used by cloaked-bot heuristics. */
export function isPrivateIp(ip: string): boolean {
  if (!ip || ip === "unknown") return true;
  if (ip === "::1" || ip.startsWith("127.")) return true;
  if (ip.startsWith("10.") || ip.startsWith("192.168.")) return true;
  if (ip.startsWith("169.254.") || ip.startsWith("fe80:")) return true;
  if (ip.startsWith("fc") || ip.startsWith("fd")) return true;
  const m = /^172\.(\d+)\./.exec(ip);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
  return false;
}

/** Derives a 2-letter country code from edge/proxy headers, or `null`. */
export function deriveCountry(event: H3Event): string | null {
  const raw
    = getHeader(event, "cf-ipcountry")
      || getHeader(event, "x-vercel-ip-country")
      || getHeader(event, "x-country-code")
      || getHeader(event, "x-geo-country");
  if (!raw) return null;
  const code = raw.trim().toUpperCase();
  // Cloudflare emits "XX"/"T1" for unknown/Tor — treat as no country.
  if (code.length !== 2 || code === "XX" || code === "T1") return null;
  return code;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Normalises a raw path into a low-cardinality route pattern by collapsing
 * identifier-like segments — keeps the rollup dimension count bounded.
 */
export function routePatternFromPath(rawPath: string): string {
  const path = (rawPath.split("?")[0] || "/").trim();
  if (path === "/") return "/";

  const pattern = path
    .split("/")
    .map((segment) => {
      if (!segment) return segment;
      if (UUID_RE.test(segment)) return ":id";
      if (/^\d+$/.test(segment)) return ":n";
      // Long opaque tokens (declaration codes, hashes, slugs with digits).
      if (segment.length >= 16 && /\d/.test(segment) && /[a-z]/i.test(segment)) return ":token";
      return segment;
    })
    .join("/");

  return pattern.length > 255 ? pattern.slice(0, 255) : pattern;
}

/** Returns the inbound request id, or generates one when absent. */
export function getRequestId(event: H3Event): string {
  return getHeader(event, "x-request-id") || getHeader(event, "x-amzn-trace-id") || randomUUID();
}

/** True when the client sent `DNT: 1` (Do Not Track). */
export function hasDoNotTrack(event: H3Event): boolean {
  return getHeader(event, "dnt") === "1" || getHeader(event, "sec-gpc") === "1";
}
