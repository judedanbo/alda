/**
 * AI crawler / scraper registry — the single editable source of truth.
 *
 * To add or adjust an AI agent, edit only this file. `match` is a lowercased
 * substring tested against the User-Agent. Entries are evaluated in array
 * order, so list more specific tokens first (e.g. `applebot-extended` before
 * `applebot`). Categories drive the per-category policy in `analytics-config`.
 *
 * Identity verification: `dnsSuffixes` enables forward-confirmed reverse DNS;
 * `rangeUrl` points at the provider's published IP-range JSON, refreshed into
 * storage by the `analytics:rollup`-adjacent refresh path. Where neither is
 * available a request can only ever be `unverified` (never falsely `spoofed`),
 * and behavioural cloaked-scraper detection takes over.
 */

export type AiCategoryKey = "TRAINING_CRAWLER" | "SEARCH_INDEXER" | "LIVE_RETRIEVAL";

export interface AiAgentDef {
  /** Canonical agent name shown in the dashboard. */
  name: string;
  /** Lowercased substring matched against the User-Agent. */
  match: string;
  /** Provider/operator, used for the AI-by-provider breakdown. */
  provider: string;
  category: AiCategoryKey;
  /** Reverse-DNS suffixes that forward-confirm a genuine request. */
  dnsSuffixes?: string[];
  /** URL of the provider's published IP-range list (for the refresh task). */
  rangeUrl?: string;
}

export interface SearchEngineDef {
  name: string;
  match: string;
  provider: string;
  dnsSuffixes?: string[];
}

/**
 * AI-provider agents. `TRAINING_CRAWLER` = dataset/model-training crawlers,
 * `SEARCH_INDEXER` = AI-search index crawlers, `LIVE_RETRIEVAL` = real-time
 * fetchers acting on behalf of a user prompt.
 */
export const AI_AGENTS: AiAgentDef[] = [
  // --- Training / dataset crawlers ---
  { name: "GPTBot", match: "gptbot", provider: "OpenAI", category: "TRAINING_CRAWLER", rangeUrl: "https://openai.com/gptbot.json" },
  { name: "ClaudeBot", match: "claudebot", provider: "Anthropic", category: "TRAINING_CRAWLER" },
  { name: "anthropic-ai", match: "anthropic-ai", provider: "Anthropic", category: "TRAINING_CRAWLER" },
  { name: "Google-Extended", match: "google-extended", provider: "Google", category: "TRAINING_CRAWLER" },
  { name: "CCBot", match: "ccbot", provider: "Common Crawl", category: "TRAINING_CRAWLER" },
  { name: "Bytespider", match: "bytespider", provider: "ByteDance", category: "TRAINING_CRAWLER" },
  { name: "Meta-ExternalAgent", match: "meta-externalagent", provider: "Meta", category: "TRAINING_CRAWLER" },
  { name: "FacebookBot", match: "facebookbot", provider: "Meta", category: "TRAINING_CRAWLER" },
  { name: "Amazonbot", match: "amazonbot", provider: "Amazon", category: "TRAINING_CRAWLER" },
  { name: "Applebot-Extended", match: "applebot-extended", provider: "Apple", category: "TRAINING_CRAWLER" },
  { name: "cohere-ai", match: "cohere-ai", provider: "Cohere", category: "TRAINING_CRAWLER" },
  { name: "cohere-training-data-crawler", match: "cohere-training-data-crawler", provider: "Cohere", category: "TRAINING_CRAWLER" },
  { name: "Diffbot", match: "diffbot", provider: "Diffbot", category: "TRAINING_CRAWLER" },
  { name: "Omgilibot", match: "omgilibot", provider: "Webz.io", category: "TRAINING_CRAWLER" },
  { name: "ImagesiftBot", match: "imagesiftbot", provider: "ImageSift", category: "TRAINING_CRAWLER" },
  { name: "PanguBot", match: "pangubot", provider: "Huawei", category: "TRAINING_CRAWLER" },
  { name: "Timpibot", match: "timpibot", provider: "Timpi", category: "TRAINING_CRAWLER" },

  // --- AI-search index crawlers ---
  { name: "OAI-SearchBot", match: "oai-searchbot", provider: "OpenAI", category: "SEARCH_INDEXER", rangeUrl: "https://openai.com/searchbot.json" },
  { name: "PerplexityBot", match: "perplexitybot", provider: "Perplexity", category: "SEARCH_INDEXER" },

  // --- Live, on-behalf-of-user fetchers ---
  { name: "ChatGPT-User", match: "chatgpt-user", provider: "OpenAI", category: "LIVE_RETRIEVAL", rangeUrl: "https://openai.com/chatgpt-user.json" },
  { name: "Claude-User", match: "claude-user", provider: "Anthropic", category: "LIVE_RETRIEVAL" },
  { name: "Claude-Web", match: "claude-web", provider: "Anthropic", category: "LIVE_RETRIEVAL" },
  { name: "Perplexity-User", match: "perplexity-user", provider: "Perplexity", category: "LIVE_RETRIEVAL" },
  { name: "DuckAssistBot", match: "duckassistbot", provider: "DuckDuckGo", category: "LIVE_RETRIEVAL" },
  { name: "Google-CloudVertexBot", match: "google-cloudvertexbot", provider: "Google", category: "LIVE_RETRIEVAL" },
  { name: "GoogleOther", match: "googleother", provider: "Google", category: "LIVE_RETRIEVAL" },
  { name: "YouBot", match: "youbot", provider: "You.com", category: "LIVE_RETRIEVAL" },
];

/**
 * Legitimate, non-AI search-engine crawlers. These are tagged as the
 * `SEARCH_BOT` visitor class and are allowed by the default policy.
 */
export const SEARCH_ENGINES: SearchEngineDef[] = [
  { name: "Googlebot", match: "googlebot", provider: "Google", dnsSuffixes: [".googlebot.com", ".google.com"] },
  { name: "Bingbot", match: "bingbot", provider: "Microsoft", dnsSuffixes: [".search.msn.com"] },
  { name: "DuckDuckBot", match: "duckduckbot", provider: "DuckDuckGo" },
  { name: "YandexBot", match: "yandexbot", provider: "Yandex", dnsSuffixes: [".yandex.com", ".yandex.net", ".yandex.ru"] },
  { name: "Baiduspider", match: "baiduspider", provider: "Baidu" },
  { name: "Applebot", match: "applebot", provider: "Apple", dnsSuffixes: [".applebot.apple.com"] },
  { name: "Yahoo Slurp", match: "slurp", provider: "Yahoo", dnsSuffixes: [".crawl.yahoo.net"] },
];

/**
 * Robots.txt `Disallow` policy expressed for the app-level enforcer. AI
 * training/indexer agents may only touch the public marketing pages; any
 * other path is a robots.txt violation. Live-retrieval agents are evaluated
 * per their own category policy rather than this list.
 */
export const AI_PUBLIC_ALLOWED_PATHS = ["/", "/contact", "/privacy", "/terms"];
