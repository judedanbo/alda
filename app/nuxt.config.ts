import tailwindcss from "@tailwindcss/vite";

// Analytics counter/abuse-state storage. Redis keeps counters correct across
// instances; when REDIS_URL is unset (or the driver is forced to "memory")
// Nitro falls back to the in-memory driver — correct only per-instance.
const analyticsUsesRedis
  = process.env.ANALYTICS_STORAGE_DRIVER !== "memory" && !!process.env.REDIS_URL;

const analyticsStorage = analyticsUsesRedis
  ? { analytics: { driver: "redis", url: process.env.REDIS_URL, base: "adla:analytics" } }
  : { analytics: { driver: "memory" } };

const envNum = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return v !== undefined && v !== "" && Number.isFinite(n) ? n : fallback;
};
const envBool = (v: string | undefined, fallback: boolean) =>
  v === undefined || v === "" ? fallback : v === "true";

// @tailwindcss/vite v4 mutates CSS chunks in generateBundle without emitting
// a sourcemap, which makes Rollup raise SOURCEMAP_BROKEN. The warning is
// logged via stderr and bypasses every Rollup/Vite onwarn/customLogger hook
// reachable from this file (the SSR Vite build creates its own logger).
// Suppress at process level since prod sourcemaps default off and the warning
// has no behavioral impact. Track removal when the plugin starts emitting maps.
const originalStderrWrite = process.stderr.write.bind(process.stderr);
process.stderr.write = ((chunk: unknown, ...rest: unknown[]) => {
  if (typeof chunk === "string"
    && chunk.includes("@tailwindcss/vite:generate:build")
    && chunk.includes("Sourcemap is likely to be incorrect")) {
    return true;
  }
  return (originalStderrWrite as (chunk: unknown, ...rest: unknown[]) => boolean)(chunk, ...rest);
}) as typeof process.stderr.write;

export default defineNuxtConfig({
  compatibilityDate: "2025-01-15",

  modules: [
    "shadcn-nuxt",
    "@pinia/nuxt",
    "@nuxtjs/color-mode",
    "@nuxt/eslint",
  ],

  css: ["~/assets/css/main.css"],

  colorMode: {
    preference: "system",
    fallback: "light",
    classSuffix: "",
    classPrefix: "theme-",
    storageKey: "adla-theme",
  },

  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: ["vue3-apexcharts", "apexcharts"],
    },
  },

  shadcn: {
    prefix: "",
    componentDir: "./components/ui",
  },

  runtimeConfig: {
    // Server-side only
    jwtSecret: process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production",
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "your-refresh-secret-key-change-in-production",
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "15m",
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",

    // Database
    databaseUrl: process.env.DATABASE_URL,

    // MinIO
    minioEndpoint: process.env.MINIO_ENDPOINT || "localhost",
    minioPort: parseInt(process.env.MINIO_PORT || "9000"),
    minioAccessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
    minioSecretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
    minioBucket: process.env.MINIO_BUCKET || "adla-uploads",

    // Email
    smtpHost: process.env.SMTP_HOST || "localhost",
    smtpPort: parseInt(process.env.SMTP_PORT || "1025"),
    smtpUser: process.env.SMTP_USER || "",
    smtpPass: process.env.SMTP_PASS || "",
    smtpFrom: process.env.SMTP_FROM || "noreply@adla.gov.gh",

    // Redis
    redisUrl: process.env.REDIS_URL || "redis://localhost:6379",

    // Web analytics, abuse detection & rate limiting (server-only).
    // Consumed via the typed helper in server/utils/analytics-config.ts.
    analytics: {
      enabled: envBool(process.env.ANALYTICS_ENABLED, true),
      captureEnabled: envBool(process.env.ANALYTICS_CAPTURE_ENABLED, true),
      abuseEnabled: envBool(process.env.ANALYTICS_ABUSE_ENABLED, true),
      aiDetectionEnabled: envBool(process.env.ANALYTICS_AI_DETECTION_ENABLED, true),
      rateLimitEnabled: envBool(process.env.ANALYTICS_RATE_LIMIT_ENABLED, true),
      ipSalt: process.env.ANALYTICS_IP_SALT || "change-this-analytics-ip-salt-in-production",
      respectDnt: envBool(process.env.ANALYTICS_RESPECT_DNT, true),
      retentionDays: envNum(process.env.ANALYTICS_RETENTION_DAYS, 30),
      rollupRetentionDays: envNum(process.env.ANALYTICS_ROLLUP_RETENTION_DAYS, 365),
      excludePaths: process.env.ANALYTICS_EXCLUDE_PATHS
        || "/_nuxt,/__nuxt,/_ipx,/favicon.ico,/api/health,/api/admin/analytics",
      storageDriver: analyticsUsesRedis ? "redis" : "memory",
      sessionWindowMinutes: envNum(process.env.ANALYTICS_SESSION_WINDOW_MINUTES, 30),
      rl: {
        ipPerMin: envNum(process.env.ANALYTICS_RL_IP_PER_MIN, 300),
        authPerMin: envNum(process.env.ANALYTICS_RL_AUTH_PER_MIN, 15),
        writePerMin: envNum(process.env.ANALYTICS_RL_WRITE_PER_MIN, 90),
        uploadPer5Min: envNum(process.env.ANALYTICS_RL_UPLOAD_PER_5MIN, 30),
        userPerMin: envNum(process.env.ANALYTICS_RL_USER_PER_MIN, 600),
        abusiveMultiplier: envNum(process.env.ANALYTICS_RL_ABUSIVE_MULTIPLIER, 0.2),
        aiThrottleMultiplier: envNum(process.env.ANALYTICS_RL_AI_THROTTLE_MULTIPLIER, 0.25),
      },
      abuse: {
        floodPerMin: envNum(process.env.ANALYTICS_ABUSE_FLOOD_PER_MIN, 600),
        errorRate: envNum(process.env.ANALYTICS_ABUSE_ERROR_RATE, 0.6),
        distinct404: envNum(process.env.ANALYTICS_ABUSE_DISTINCT_404, 12),
        failedLogins: envNum(process.env.ANALYTICS_ABUSE_FAILED_LOGINS, 8),
        suspiciousScore: envNum(process.env.ANALYTICS_ABUSE_SUSPICIOUS_SCORE, 40),
        abusiveScore: envNum(process.env.ANALYTICS_ABUSE_ABUSIVE_SCORE, 75),
        blockMinutes: envNum(process.env.ANALYTICS_ABUSE_BLOCK_MINUTES, 30),
      },
      ai: {
        trainingPolicy: process.env.ANALYTICS_AI_TRAINING_POLICY || "block",
        searchPolicy: process.env.ANALYTICS_AI_SEARCH_POLICY || "allow",
        liveRetrievalPolicy: process.env.ANALYTICS_AI_LIVE_RETRIEVAL_POLICY || "log",
        unknownPolicy: process.env.ANALYTICS_AI_UNKNOWN_POLICY || "throttle",
        robotsEnforcement: envBool(process.env.ANALYTICS_AI_ROBOTS_ENFORCEMENT, true),
        ipRangeRefreshHours: envNum(process.env.ANALYTICS_AI_IP_RANGE_REFRESH_HOURS, 24),
      },
    },

    // Public runtime config (exposed to client)
    public: {
      appName: "Asset Declaration Portal",
      appUrl: process.env.APP_URL || "http://localhost:3000",
      devMode: process.env.NODE_ENV !== "production",
    },
  },

  nitro: {
    storage: analyticsStorage,
    esbuild: {
      options: { target: "es2022" },
    },
    experimental: {
      tasks: true,
    },
    scheduledTasks: {
      // Roll raw traffic events into hourly/daily aggregates every 10 min.
      "*/10 * * * *": ["analytics:rollup"],
      // Prune raw events past the retention window, daily at 03:30.
      "30 3 * * *": ["analytics:prune"],
    },
  },

  typescript: {
    strict: true,
  },

  build: {
    transpile: ["vue3-apexcharts", "apexcharts"],
  },

  // Nuxt 4 features
  future: {
    compatibilityVersion: 4,
  },
});
