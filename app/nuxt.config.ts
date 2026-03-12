import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: "2025-01-15",
  devtools: { enabled: true },

  modules: [
    "shadcn-nuxt",
    "@pinia/nuxt",
  ],

  css: ["~/assets/css/main.css"],

  vite: {
    plugins: [tailwindcss()],
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

    // Public runtime config (exposed to client)
    public: {
      appName: "Asset Declaration Portal",
      appUrl: process.env.APP_URL || "http://localhost:3000",
    },
  },

  nitro: {
    // asyncContext is now stable in Nuxt 4
  },

  typescript: {
    strict: true,
  },

  // Nuxt 4 features
  future: {
    compatibilityVersion: 4,
  },
});
