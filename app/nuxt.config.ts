import tailwindcss from "@tailwindcss/vite";

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

    // Public runtime config (exposed to client)
    public: {
      appName: "Asset Declaration Portal",
      appUrl: process.env.APP_URL || "http://localhost:3000",
      devMode: process.env.NODE_ENV !== "production",
    },
  },

  nitro: {
    // asyncContext is now stable in Nuxt 4
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
