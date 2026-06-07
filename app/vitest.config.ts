import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

const appRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  // Mirror the Nuxt path aliases so server modules importing `~/server/...`
  // resolve under Vitest.
  resolve: {
    alias: {
      "~": appRoot,
      "@": appRoot,
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    // Integration tests need a real Postgres and run under their own config
    // (vitest.integration.config.ts / `npm run test:integration`).
    exclude: [...configDefaults.exclude, "test/integration/**"],
    setupFiles: ["./test/setup.ts"],
  },
});
