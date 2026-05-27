import { createHash, randomUUID } from "node:crypto";
import type { H3Event } from "h3";
import { ipInCidr } from "./ai-agents";
import { getAnalyticsConfig } from "./analytics-config";

/**
 * Request metadata helpers shared by traffic capture, abuse scoring and rate
 * limiting: client-IP extraction, privacy-preserving IP transforms, geo
 * derivation, route-pattern normalisation and request ids.
 */

/**
 * Normalises an IP for storage / comparison. Strips IPv6 zone IDs (`%eth0`)
 * and unwraps IPv4-mapped IPv6 addresses (`::ffff:1.2.3.4` → `1.2.3.4`) so a
 * dual-stack client doesn't end up in two different rate-limit buckets.
 */
export function normalizeIp(ip: string): string {
  if (!ip) return ip;
  const stripped = ip.split("%")[0]!.trim();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(stripped);
  return mapped && mapped[1] ? mapped[1] : stripped;
}

function isTrusted(ip: string, trustedProxies: string[]): boolean {
  return trustedProxies.some((cidr) => ipInCidr(ip, cidr));
}

/**
 * Extract the client IP, gating `X-Forwarded-For` / `X-Real-IP` on a trusted-
 * proxy list. The socket peer is the source of truth: forwarding headers are
 * honored ONLY when the immediate peer matches a CIDR in
 * `runtimeConfig.analytics.trustedProxies` (set via the
 * `ANALYTICS_TRUSTED_PROXIES` env var). Default = empty list = trust nothing.
 *
 * When the peer is trusted, the `X-Forwarded-For` chain is walked
 * right-to-left, dropping trusted hops, returning the first untrusted hop —
 * so an attacker's leftmost spoof cannot impersonate the real client.
 *
 * The trust list is parameterised for testability; production callers omit
 * it and pick up the resolved config.
 */
export function extractClientIp(
  event: H3Event,
  trustedProxies: string[] = getAnalyticsConfig().trustedProxies,
): string {
  const socketRaw = event.node?.req?.socket?.remoteAddress;
  const socket = socketRaw ? normalizeIp(socketRaw) : "";

  // Bare deployment (no proxies declared) or peer isn't a known proxy:
  // ignore all forwarding headers. Socket peer is the only honest value.
  if (trustedProxies.length === 0 || !socket || !isTrusted(socket, trustedProxies)) {
    return socket || "unknown";
  }

  const xff = getHeader(event, "x-forwarded-for");
  if (xff) {
    const chain = xff.split(",").map((s) => normalizeIp(s)).filter(Boolean);
    // Walk right-to-left: drop trusted hops until the first untrusted one.
    for (let i = chain.length - 1; i >= 0; i--) {
      if (!isTrusted(chain[i]!, trustedProxies)) return chain[i]!;
    }
    // Every hop in the chain was trusted — the leftmost is the original client.
    if (chain.length > 0) return chain[0]!;
  }

  const real = getHeader(event, "x-real-ip");
  if (real) return normalizeIp(real);

  return socket;
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
