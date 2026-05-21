import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

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
    setupFiles: ["./test/setup.ts"],
  },
});
