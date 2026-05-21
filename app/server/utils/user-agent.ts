/**
 * Lightweight, dependency-free User-Agent parser.
 *
 * A full UA-parsing library was deliberately avoided: this is a government PII
 * system where every added dependency is supply-chain surface, and the
 * analytics layer only needs coarse browser / OS / device / bot signals. The
 * regex set below is intentionally small and easy to audit. AI-crawler and
 * search-engine identification lives in `ai-agents.ts`, not here.
 */

export type DeviceType = "desktop" | "mobile" | "tablet" | "bot" | "unknown";

export interface ParsedUserAgent {
  browser: string;
  os: string;
  deviceType: DeviceType;
  /** Generic bot heuristic — true for crawlers, libraries and headless tools. */
  isBot: boolean;
  /** Best-effort bot/library name when `isBot` is true. */
  botName: string | null;
}

// Generic, non-AI bot/automation markers. AI crawlers are matched separately.
const BOT_MARKERS: Array<[RegExp, string]> = [
  [/googlebot/i, "Googlebot"],
  [/bingbot|bingpreview/i, "Bingbot"],
  [/slurp/i, "Yahoo Slurp"],
  [/duckduckbot|duckduckgo/i, "DuckDuckBot"],
  [/yandex(bot|images)/i, "YandexBot"],
  [/baiduspider/i, "Baiduspider"],
  [/applebot/i, "Applebot"],
  [/semrushbot/i, "SemrushBot"],
  [/ahrefsbot/i, "AhrefsBot"],
  [/mj12bot/i, "MJ12bot"],
  [/dotbot/i, "DotBot"],
  [/petalbot/i, "PetalBot"],
  [/uptimerobot/i, "UptimeRobot"],
  [/pingdom/i, "Pingdom"],
  [/facebookexternalhit/i, "facebookexternalhit"],
  [/twitterbot/i, "Twitterbot"],
  [/linkedinbot/i, "LinkedInBot"],
  [/slackbot/i, "Slackbot"],
  [/discordbot/i, "Discordbot"],
  [/telegrambot/i, "TelegramBot"],
  [/whatsapp/i, "WhatsApp"],
  [/headlesschrome/i, "HeadlessChrome"],
  [/phantomjs/i, "PhantomJS"],
  [/playwright/i, "Playwright"],
  [/puppeteer/i, "Puppeteer"],
  [/python-requests|python-urllib|aiohttp|httpx/i, "Python HTTP client"],
  [/curl\//i, "curl"],
  [/wget/i, "Wget"],
  [/go-http-client/i, "Go HTTP client"],
  [/java\/|okhttp|apache-httpclient/i, "Java HTTP client"],
  [/axios|node-fetch|got \(/i, "Node HTTP client"],
  [/scrapy/i, "Scrapy"],
  [/\bbot\b|crawler|spider|crawl/i, "Generic bot"],
];

const BROWSERS: Array<[RegExp, string]> = [
  [/edg(?:a|ios|)\//i, "Edge"],
  [/opr\/|opera/i, "Opera"],
  [/samsungbrowser/i, "Samsung Internet"],
  [/firefox\/|fxios\//i, "Firefox"],
  [/chrome\/|crios\//i, "Chrome"],
  [/safari\//i, "Safari"],
  [/msie |trident\//i, "Internet Explorer"],
];

const OSES: Array<[RegExp, string]> = [
  [/windows nt 10/i, "Windows 10/11"],
  [/windows nt/i, "Windows"],
  [/iphone|ipad|ipod/i, "iOS"],
  [/mac os x/i, "macOS"],
  [/cros/i, "ChromeOS"],
  [/android/i, "Android"],
  [/linux/i, "Linux"],
];

/**
 * Parses a raw User-Agent string into coarse browser / OS / device signals.
 * Always returns a result; an empty or missing UA yields `"unknown"` fields
 * and `isBot: true` (a missing UA is itself a weak bot/automation signal).
 */
export function parseUserAgent(ua: string | null | undefined): ParsedUserAgent {
  if (!ua || ua.trim() === "") {
    return { browser: "unknown", os: "unknown", deviceType: "unknown", isBot: true, botName: "Missing UA" };
  }

  let isBot = false;
  let botName: string | null = null;
  for (const [pattern, name] of BOT_MARKERS) {
    if (pattern.test(ua)) {
      isBot = true;
      botName = name;
      break;
    }
  }

  let browser = "unknown";
  for (const [pattern, name] of BROWSERS) {
    if (pattern.test(ua)) {
      browser = name;
      break;
    }
  }

  let os = "unknown";
  for (const [pattern, name] of OSES) {
    if (pattern.test(ua)) {
      os = name;
      break;
    }
  }

  let deviceType: DeviceType;
  if (isBot) {
    deviceType = "bot";
  } else if (/ipad|tablet|playbook|silk|(android(?!.*mobi))/i.test(ua)) {
    deviceType = "tablet";
  } else if (/mobi|iphone|ipod|android.*mobile|windows phone/i.test(ua)) {
    deviceType = "mobile";
  } else if (browser !== "unknown") {
    deviceType = "desktop";
  } else {
    deviceType = "unknown";
  }

  return { browser, os, deviceType, isBot, botName };
}
