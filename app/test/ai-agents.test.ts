import { describe, it, expect } from "vitest";
import {
  classifyVisitor,
  matchAiAgent,
  ipInCidr,
  detectCloakedScraper,
  isAiRobotsViolation,
  verifyAiIdentity,
} from "../server/utils/ai-agents";
import { AI_AGENTS } from "../server/utils/ai-agents.data";
import { StorageKeys } from "../server/utils/analytics-storage";
import { makeFakeStorage } from "./helpers";

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

describe("classifyVisitor", () => {
  it("classifies a known AI training crawler", () => {
    const c = classifyVisitor("Mozilla/5.0 AppleWebKit/537.36 (compatible; GPTBot/1.2; +https://openai.com/gptbot)");
    expect(c.visitorClass).toBe("AI_AGENT");
    expect(c.aiProvider).toBe("OpenAI");
    expect(c.aiCategory).toBe("TRAINING_CRAWLER");
  });

  it("classifies an AI live-retrieval agent", () => {
    const c = classifyVisitor("Mozilla/5.0 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)");
    expect(c.visitorClass).toBe("AI_AGENT");
    expect(c.aiCategory).toBe("LIVE_RETRIEVAL");
  });

  it("classifies a legitimate search engine as a search bot, not AI", () => {
    const c = classifyVisitor("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)");
    expect(c.visitorClass).toBe("SEARCH_BOT");
    expect(c.aiProvider).toBeNull();
  });

  it("classifies a real browser as human", () => {
    expect(classifyVisitor(CHROME).visitorClass).toBe("HUMAN");
  });

  it("classifies a generic HTTP client as another bot", () => {
    expect(classifyVisitor("python-requests/2.31.0").visitorClass).toBe("OTHER_BOT");
  });
});

describe("matchAiAgent", () => {
  it("matches by user-agent token", () => {
    expect(matchAiAgent("something ClaudeBot/1.0 here")?.provider).toBe("Anthropic");
    expect(matchAiAgent("PerplexityBot/1.0")?.category).toBe("SEARCH_INDEXER");
    expect(matchAiAgent(CHROME)).toBeNull();
  });
});

describe("ipInCidr", () => {
  it("matches IPv4 addresses inside a CIDR block", () => {
    expect(ipInCidr("192.168.1.50", "192.168.1.0/24")).toBe(true);
    expect(ipInCidr("192.168.2.50", "192.168.1.0/24")).toBe(false);
    expect(ipInCidr("10.1.2.3", "10.0.0.0/8")).toBe(true);
    expect(ipInCidr("203.0.113.7", "203.0.113.7/32")).toBe(true);
  });
  it("matches IPv6 addresses inside a CIDR block", () => {
    expect(ipInCidr("2001:db8::1", "2001:db8::/32")).toBe(true);
    expect(ipInCidr("2001:dc8::1", "2001:db8::/32")).toBe(false);
  });
  it("rejects malformed input", () => {
    expect(ipInCidr("not-an-ip", "192.168.1.0/24")).toBe(false);
    expect(ipInCidr("192.168.1.1", "garbage")).toBe(false);
  });
});

describe("detectCloakedScraper", () => {
  const browserBase = {
    browser: "Chrome",
    isBot: false,
    isDeclaredAgent: false,
    hasCookies: true,
    acceptsHtml: true,
    hasBrowserHeaders: true,
    isContentRoute: true,
    isDatacenterIp: false,
    userAgent: CHROME,
  };

  it("does not flag a normal browser", () => {
    expect(detectCloakedScraper(browserBase).cloaked).toBe(false);
  });

  it("flags an HTTP-client user-agent on a content route", () => {
    const result = detectCloakedScraper({
      ...browserBase,
      browser: "unknown",
      userAgent: "python-requests/2.31.0",
      hasCookies: false,
      acceptsHtml: false,
      hasBrowserHeaders: false,
      isDatacenterIp: true,
    });
    expect(result.cloaked).toBe(true);
    expect(result.reasons).toContain("http-client-user-agent");
  });

  it("never flags a declared agent as cloaked", () => {
    expect(detectCloakedScraper({ ...browserBase, isDeclaredAgent: true, userAgent: "curl/8.0" }).cloaked).toBe(false);
  });
});

describe("isAiRobotsViolation", () => {
  it("allows public marketing pages and assets", () => {
    expect(isAiRobotsViolation("/")).toBe(false);
    expect(isAiRobotsViolation("/contact")).toBe(false);
    expect(isAiRobotsViolation("/privacy")).toBe(false);
    expect(isAiRobotsViolation("/_nuxt/entry.js")).toBe(false);
  });
  it("flags the authenticated app and API", () => {
    expect(isAiRobotsViolation("/admin/users")).toBe(true);
    expect(isAiRobotsViolation("/applicant/dashboard")).toBe(true);
    expect(isAiRobotsViolation("/api/declarations")).toBe(true);
  });
});

describe("verifyAiIdentity — published IP range path", () => {
  const gptbot = AI_AGENTS.find((a) => a.name === "GPTBot")!;

  it("verifies an IP inside the provider's published range", async () => {
    const storage = makeFakeStorage();
    await storage.setItem(StorageKeys.aiRanges("GPTBot"), ["203.0.113.0/24"]);
    expect(await verifyAiIdentity(gptbot, "203.0.113.40", storage)).toBe("verified");
  });

  it("flags an IP outside the published range as spoofed", async () => {
    const storage = makeFakeStorage();
    await storage.setItem(StorageKeys.aiRanges("GPTBot"), ["203.0.113.0/24"]);
    expect(await verifyAiIdentity(gptbot, "198.51.100.7", storage)).toBe("spoofed");
  });

  it("returns unverified for private IPs", async () => {
    const storage = makeFakeStorage();
    expect(await verifyAiIdentity(gptbot, "127.0.0.1", storage)).toBe("unverified");
  });

  it("returns unverified when no ranges are available", async () => {
    const storage = makeFakeStorage();
    expect(await verifyAiIdentity(gptbot, "203.0.113.40", storage)).toBe("unverified");
  });
});
