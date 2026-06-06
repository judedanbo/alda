import { promises as dns } from "node:dns";
import {
  AI_AGENTS,
  AI_PUBLIC_ALLOWED_PATHS,
  SEARCH_ENGINES,
  type AiAgentDef,
  type SearchEngineDef,
} from "./ai-agents.data";
import { parseUserAgent } from "./user-agent";
import { isPrivateIp } from "./request-meta";
import { getAnalyticsConfig, type AiPolicy } from "./analytics-config";
import {
  StorageKeys,
  safeGet,
  safeSet,
  type KvStorage,
} from "./analytics-storage";

/**
 * AI crawler / scraper detection: registry matching, visitor classification,
 * declared-identity verification (reverse DNS + published IP ranges) and
 * behavioural cloaked-scraper heuristics.
 *
 * L-8 — important note on what this enforces vs. what it doesn't:
 *
 * User-Agent matching against the `AI_AGENTS` / `SEARCH_ENGINES` registries
 * is a *politeness signal*, not a security boundary. Any caller can claim
 * any User-Agent string in a single HTTP header; well-behaved crawlers
 * (Google, OpenAI, Anthropic, …) self-identify because their reputation
 * depends on it, and we honour that by applying the configured per-category
 * policy (allow / log / throttle / block).
 *
 * The actual defence against *undeclared* / cloaked scrapers lives in
 * `app/server/plugins/traffic.ts:detectCloakedScraper`, which scores
 * behavioural fingerprints (datacenter ASN ranges, missing browser
 * headers, sessionless cookie usage, request cadence). That's what catches
 * the headless-Chrome-pretending-to-be-Safari case.
 *
 * Don't add security-critical decisions that branch only on the UA-match
 * result; gate them on `verifyAiIdentity()` (reverse DNS + IP-range) or
 * on the cloaked-scraper score.
 */

export type VisitorClassValue = "HUMAN" | "SEARCH_BOT" | "AI_AGENT" | "OTHER_BOT";
export type AiCategoryValue = "TRAINING_CRAWLER" | "SEARCH_INDEXER" | "LIVE_RETRIEVAL" | "UNKNOWN_SCRAPER";
export type AiVerificationVerdict = "verified" | "spoofed" | "unverified";

export interface VisitorClassification {
  visitorClass: VisitorClassValue;
  isBot: boolean;
  aiProvider: string | null;
  aiCategory: AiCategoryValue | null;
  aiAgentName: string | null;
  searchEngine: string | null;
  /** The matched AI registry entry, when the visitor is an AI agent. */
  agentDef: AiAgentDef | null;
}

/** Finds the AI registry entry whose token appears in the User-Agent. */
export function matchAiAgent(ua: string | null | undefined): AiAgentDef | null {
  if (!ua) return null;
  const lower = ua.toLowerCase();
  for (const def of AI_AGENTS) {
    if (lower.includes(def.match)) return def;
  }
  return null;
}

/** Finds the legitimate search-engine entry whose token appears in the UA. */
export function matchSearchEngine(ua: string | null | undefined): SearchEngineDef | null {
  if (!ua) return null;
  const lower = ua.toLowerCase();
  for (const def of SEARCH_ENGINES) {
    if (lower.includes(def.match)) return def;
  }
  return null;
}

/**
 * Classifies a visitor from its User-Agent into one of the four visitor
 * classes, attaching AI provider/category when relevant.
 */
export function classifyVisitor(ua: string | null | undefined): VisitorClassification {
  const aiDef = matchAiAgent(ua);
  if (aiDef) {
    return {
      visitorClass: "AI_AGENT",
      isBot: true,
      aiProvider: aiDef.provider,
      aiCategory: aiDef.category,
      aiAgentName: aiDef.name,
      searchEngine: null,
      agentDef: aiDef,
    };
  }

  const searchDef = matchSearchEngine(ua);
  if (searchDef) {
    return {
      visitorClass: "SEARCH_BOT",
      isBot: true,
      aiProvider: null,
      aiCategory: null,
      aiAgentName: null,
      searchEngine: searchDef.name,
      agentDef: null,
    };
  }

  const parsed = parseUserAgent(ua);
  return {
    visitorClass: parsed.isBot ? "OTHER_BOT" : "HUMAN",
    isBot: parsed.isBot,
    aiProvider: null,
    aiCategory: null,
    aiAgentName: null,
    searchEngine: null,
    agentDef: null,
  };
}

/** Resolves the configured policy for an AI category. */
export function policyForAiCategory(category: AiCategoryValue): AiPolicy {
  const { ai } = getAnalyticsConfig();
  switch (category) {
    case "TRAINING_CRAWLER":
      return ai.trainingPolicy;
    case "SEARCH_INDEXER":
      return ai.searchPolicy;
    case "LIVE_RETRIEVAL":
      return ai.liveRetrievalPolicy;
    case "UNKNOWN_SCRAPER":
    default:
      return ai.unknownPolicy;
  }
}

// ----------------------------------------------------------------------------
// CIDR matching
// ----------------------------------------------------------------------------

function ipv4ToBigInt(ip: string): bigint | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0n;
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    value = (value << 8n) | BigInt(n);
  }
  return value;
}

function ipv6ToBigInt(ip: string): bigint | null {
  // Strip zone id and unwrap IPv4-mapped addresses.
  const addr = ip.split("%")[0] || ip;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(addr);
  if (mapped && mapped[1]) {
    const v4 = ipv4ToBigInt(mapped[1]);
    return v4 === null ? null : v4 + 0xffff00000000n;
  }
  const halves = addr.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":").filter(Boolean) : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":").filter(Boolean) : [];
  const missing = 8 - head.length - tail.length;
  if (missing < 0 || (halves.length === 1 && head.length !== 8)) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...tail];
  if (groups.length !== 8) return null;
  let value = 0n;
  for (const group of groups) {
    const n = parseInt(group, 16);
    if (!Number.isInteger(n) || n < 0 || n > 0xffff) return null;
    value = (value << 16n) | BigInt(n);
  }
  return value;
}

/** True when `ip` falls inside the CIDR block. Supports IPv4 and IPv6. */
export function ipInCidr(ip: string, cidr: string): boolean {
  try {
    const [range, bitsRaw] = cidr.split("/");
    if (!range) return false;
    const isV6 = range.includes(":");
    const totalBits = isV6 ? 128 : 32;
    const bits = bitsRaw === undefined ? totalBits : Number(bitsRaw);
    if (!Number.isInteger(bits) || bits < 0 || bits > totalBits) return false;

    const ipVal = isV6 ? ipv6ToBigInt(ip) : ipv4ToBigInt(ip);
    const rangeVal = isV6 ? ipv6ToBigInt(range) : ipv4ToBigInt(range);
    if (ipVal === null || rangeVal === null) return false;

    if (bits === 0) return true;
    const mask = ((1n << BigInt(bits)) - 1n) << BigInt(totalBits - bits);
    return (ipVal & mask) === (rangeVal & mask);
  } catch {
    return false;
  }
}

// ----------------------------------------------------------------------------
// Declared-identity verification
// ----------------------------------------------------------------------------

async function reverseDnsVerdict(
  def: AiAgentDef | SearchEngineDef,
  ip: string,
): Promise<AiVerificationVerdict | null> {
  if (!def.dnsSuffixes || def.dnsSuffixes.length === 0) return null;
  let hostnames: string[];
  try {
    hostnames = await dns.reverse(ip);
  } catch {
    // rDNS failure is inconclusive — never treat it as spoofing.
    return null;
  }
  if (hostnames.length === 0) return "spoofed";

  const match = hostnames.find((host) =>
    def.dnsSuffixes!.some((suffix) => host.toLowerCase().endsWith(suffix)),
  );
  if (!match) return "spoofed";

  // Forward-confirm: the matching hostname must resolve back to this IP.
  try {
    const forward = [
      ...await dns.resolve4(match).catch(() => []),
      ...await dns.resolve6(match).catch(() => []),
    ];
    return forward.includes(ip) ? "verified" : "spoofed";
  } catch {
    return null;
  }
}

async function ipRangeVerdict(
  def: AiAgentDef,
  ip: string,
  storage: KvStorage,
): Promise<AiVerificationVerdict | null> {
  if (!def.rangeUrl) return null;
  const ranges = await safeGet<string[]>(storage, StorageKeys.aiRanges(def.name));
  if (!ranges || ranges.length === 0) return null;
  return ranges.some((cidr) => ipInCidr(ip, cidr)) ? "verified" : "spoofed";
}

/**
 * Verifies that a request really comes from the AI agent it claims to be.
 * The verdict is cached in storage so the security middleware can read it
 * synchronously on the next request without paying for a DNS round-trip.
 */
export async function verifyAiIdentity(
  def: AiAgentDef,
  ip: string,
  storage: KvStorage,
): Promise<AiVerificationVerdict> {
  if (!ip || ip === "unknown" || isPrivateIp(ip)) return "unverified";

  const cacheKey = StorageKeys.aiVerify(ip);
  const cached = await safeGet<AiVerificationVerdict>(storage, cacheKey);
  if (cached) return cached;

  let verdict: AiVerificationVerdict = "unverified";
  const dnsResult = await reverseDnsVerdict(def, ip);
  if (dnsResult) {
    verdict = dnsResult;
  } else {
    const rangeResult = await ipRangeVerdict(def, ip, storage);
    if (rangeResult) verdict = rangeResult;
  }

  // Cache verified longer than spoofed/unverified so transient DNS issues
  // and freshly-refreshed ranges get re-evaluated reasonably soon.
  await safeSet(storage, cacheKey, verdict, verdict === "verified" ? 21600 : 3600);
  return verdict;
}

// ----------------------------------------------------------------------------
// Cloaked / undisclosed scraper heuristics
// ----------------------------------------------------------------------------

export interface CloakedSignals {
  /** Parsed UA browser ("unknown" when unrecognised). */
  browser: string;
  /** Generic bot heuristic from `parseUserAgent`. */
  isBot: boolean;
  /** Was the request a declared AI agent or known search engine? */
  isDeclaredAgent: boolean;
  /** Request carried a Cookie header. */
  hasCookies: boolean;
  /** Accept header advertises text/html. */
  acceptsHtml: boolean;
  /** Request carried browser `sec-fetch-*` / `accept-language` headers. */
  hasBrowserHeaders: boolean;
  /** Path is an HTML content route (not an asset or API call). */
  isContentRoute: boolean;
  /** Client IP is a datacenter / non-private public address. */
  isDatacenterIp: boolean;
  /** Raw User-Agent string. */
  userAgent: string;
}

export interface CloakedResult {
  cloaked: boolean;
  reasons: string[];
}

/**
 * Behavioural detection of undisclosed scrapers: a client that pulls HTML
 * content pages while behaving nothing like a real browser. Declared agents
 * are exempt — they are handled by the AI policy, not as cloaked scrapers.
 */
export function detectCloakedScraper(signals: CloakedSignals): CloakedResult {
  const reasons: string[] = [];
  if (signals.isDeclaredAgent || !signals.isContentRoute) {
    return { cloaked: false, reasons };
  }

  const lib = /python-requests|python-urllib|aiohttp|httpx|go-http-client|okhttp|axios|node-fetch|curl\/|wget|scrapy|java\//i;
  if (lib.test(signals.userAgent)) reasons.push("http-client-user-agent");
  if (!signals.userAgent || signals.userAgent.trim() === "") reasons.push("missing-user-agent");
  if (signals.browser === "unknown" && !signals.isBot) reasons.push("unrecognised-user-agent");
  if (!signals.acceptsHtml) reasons.push("does-not-accept-html");
  if (!signals.hasBrowserHeaders) reasons.push("missing-browser-headers");
  if (!signals.hasCookies) reasons.push("no-cookies");
  if (signals.isDatacenterIp) reasons.push("datacenter-ip-on-content-route");

  // A bare HTTP-client UA, or several weaker signals together, marks a cloak.
  const hardSignal = reasons.includes("http-client-user-agent") || reasons.includes("missing-user-agent");
  const cloaked = hardSignal || reasons.length >= 3;
  return { cloaked, reasons };
}

/**
 * True when an AI agent fetched a path it is not permitted to crawl. Public
 * marketing pages and static assets are allowed; everything else (the
 * authenticated app, the API) is a robots.txt violation.
 */
export function isAiRobotsViolation(path: string): boolean {
  const clean = (path.split("?")[0] || "/").toLowerCase();
  if (AI_PUBLIC_ALLOWED_PATHS.includes(clean)) return false;
  if (/\.(css|js|mjs|png|jpe?g|svg|gif|webp|ico|woff2?|ttf|map|txt|xml)$/.test(clean)) return false;
  if (clean.startsWith("/_nuxt") || clean.startsWith("/_ipx")) return false;
  return true;
}

/**
 * Best-effort refresh of published AI IP ranges into storage. Network failures
 * are swallowed — verification then falls back to reverse DNS or `unverified`.
 */
export async function refreshAiIpRanges(storage: KvStorage): Promise<number> {
  let refreshed = 0;
  for (const def of AI_AGENTS) {
    if (!def.rangeUrl) continue;
    try {
      const data = await $fetch<{ prefixes?: Array<{ ipv4Prefix?: string; ipv6Prefix?: string }> }>(
        def.rangeUrl,
        { timeout: 8000 },
      );
      const cidrs = (data?.prefixes ?? [])
        .map((p) => p.ipv4Prefix || p.ipv6Prefix)
        .filter((v): v is string => !!v);
      if (cidrs.length > 0) {
        await safeSet(storage, StorageKeys.aiRanges(def.name), cidrs, 7 * 24 * 3600);
        refreshed++;
      }
    } catch (error) {
      console.error(`[ai-agents] IP-range refresh failed for ${def.name}:`, error);
    }
  }
  return refreshed;
}
