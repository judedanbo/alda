/**
 * Central, typed accessor for the analytics / abuse / rate-limit configuration.
 *
 * Every other module in this subsystem reads its settings from here rather
 * than touching `useRuntimeConfig()` or `process.env` directly, so toggles and
 * thresholds have a single source of truth (see `runtimeConfig.analytics` in
 * `nuxt.config.ts`).
 */

export type AiPolicy = "allow" | "log" | "throttle" | "block";

export interface AnalyticsConfig {
  /** Master switch — when false the whole subsystem is inert. */
  enabled: boolean;
  /** Capture HTTP requests as traffic events. */
  captureEnabled: boolean;
  /** Run abuse scoring + tiered enforcement. */
  abuseEnabled: boolean;
  /** Classify AI crawlers/scrapers and apply per-category policy. */
  aiDetectionEnabled: boolean;
  /** Enforce layered rate limits. */
  rateLimitEnabled: boolean;
  /** Capture classified fuzzing/probing attempts as durable records. */
  fuzzingEnabled: boolean;
  /** Salt for hashing client IPs before storage. */
  ipSalt: string;
  /**
   * CIDRs (IPv4 or IPv6) whose `X-Forwarded-For` / `X-Real-IP` headers may
   * be trusted. The socket peer must match one of these for forwarding
   * headers to be honored — otherwise the socket peer is treated as the
   * client. Empty list = trust nothing (correct for bare-Node deployments).
   */
  trustedProxies: string[];
  /** Honour the `DNT: 1` request header. */
  respectDnt: boolean;
  /** Days to keep raw traffic events. */
  retentionDays: number;
  /** Days to keep rollup aggregates. */
  rollupRetentionDays: number;
  /** Path prefixes excluded from capture + enforcement. */
  excludePaths: string[];
  /** Active counter storage backend. */
  storageDriver: "redis" | "memory";
  /** Anonymous-visitor session inactivity window, in minutes. */
  sessionWindowMinutes: number;
  rl: {
    ipPerMin: number;
    authPerMin: number;
    writePerMin: number;
    uploadPer5Min: number;
    userPerMin: number;
    abusiveMultiplier: number;
    aiThrottleMultiplier: number;
  };
  abuse: {
    floodPerMin: number;
    errorRate: number;
    distinct404: number;
    failedLogins: number;
    suspiciousScore: number;
    abusiveScore: number;
    blockMinutes: number;
  };
  ai: {
    trainingPolicy: AiPolicy;
    searchPolicy: AiPolicy;
    liveRetrievalPolicy: AiPolicy;
    unknownPolicy: AiPolicy;
    robotsEnforcement: boolean;
    ipRangeRefreshHours: number;
  };
}

function asPolicy(value: unknown, fallback: AiPolicy): AiPolicy {
  return value === "allow" || value === "log" || value === "throttle" || value === "block"
    ? value
    : fallback;
}

let cached: AnalyticsConfig | null = null;

/**
 * Returns the resolved analytics configuration. Cached after first access
 * because `runtimeConfig` is immutable for the process lifetime.
 */
export function getAnalyticsConfig(): AnalyticsConfig {
  if (cached) return cached;

  const raw = (useRuntimeConfig().analytics ?? {}) as Record<string, unknown>;
  const rl = (raw.rl ?? {}) as Record<string, unknown>;
  const abuse = (raw.abuse ?? {}) as Record<string, unknown>;
  const ai = (raw.ai ?? {}) as Record<string, unknown>;

  cached = {
    enabled: raw.enabled !== false,
    captureEnabled: raw.captureEnabled !== false,
    abuseEnabled: raw.abuseEnabled !== false,
    aiDetectionEnabled: raw.aiDetectionEnabled !== false,
    rateLimitEnabled: raw.rateLimitEnabled !== false,
    fuzzingEnabled: raw.fuzzingEnabled !== false,
    ipSalt: String(raw.ipSalt || "adla-analytics-default-salt"),
    trustedProxies: Array.isArray(raw.trustedProxies)
      ? (raw.trustedProxies as unknown[]).map((p) => String(p).trim()).filter(Boolean)
      : [],
    respectDnt: raw.respectDnt !== false,
    retentionDays: Number(raw.retentionDays) || 30,
    rollupRetentionDays: Number(raw.rollupRetentionDays) || 365,
    excludePaths: String(raw.excludePaths || "")
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean),
    storageDriver: raw.storageDriver === "redis" ? "redis" : "memory",
    sessionWindowMinutes: Number(raw.sessionWindowMinutes) || 30,
    rl: {
      ipPerMin: Number(rl.ipPerMin) || 300,
      authPerMin: Number(rl.authPerMin) || 15,
      writePerMin: Number(rl.writePerMin) || 90,
      uploadPer5Min: Number(rl.uploadPer5Min) || 30,
      userPerMin: Number(rl.userPerMin) || 600,
      abusiveMultiplier: Number(rl.abusiveMultiplier) || 0.2,
      aiThrottleMultiplier: Number(rl.aiThrottleMultiplier) || 0.25,
    },
    abuse: {
      floodPerMin: Number(abuse.floodPerMin) || 600,
      errorRate: Number(abuse.errorRate) || 0.6,
      distinct404: Number(abuse.distinct404) || 12,
      failedLogins: Number(abuse.failedLogins) || 8,
      suspiciousScore: Number(abuse.suspiciousScore) || 40,
      abusiveScore: Number(abuse.abusiveScore) || 75,
      blockMinutes: Number(abuse.blockMinutes) || 30,
    },
    ai: {
      trainingPolicy: asPolicy(ai.trainingPolicy, "block"),
      searchPolicy: asPolicy(ai.searchPolicy, "allow"),
      liveRetrievalPolicy: asPolicy(ai.liveRetrievalPolicy, "log"),
      unknownPolicy: asPolicy(ai.unknownPolicy, "throttle"),
      robotsEnforcement: ai.robotsEnforcement !== false,
      ipRangeRefreshHours: Number(ai.ipRangeRefreshHours) || 24,
    },
  };

  return cached;
}

/** True when `path` matches one of the configured excluded prefixes. */
export function isExcludedPath(path: string, config = getAnalyticsConfig()): boolean {
  return config.excludePaths.some((prefix) => path === prefix || path.startsWith(prefix));
}

/** Test-only: drop the memoised config so a fresh `useRuntimeConfig()` is read. */
export function resetAnalyticsConfigCache(): void {
  cached = null;
}
