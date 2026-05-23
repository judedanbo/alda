/**
 * Vitest setup — provides the Nitro/h3 auto-imports that the analytics server
 * utilities reference as ambient globals, plus a stub `useRuntimeConfig` so
 * `getAnalyticsConfig()` resolves outside the Nitro runtime.
 */
import { vi } from "vitest";
import {
  createError,
  getHeader,
  getCookie,
  setCookie,
  setResponseHeader,
  getRequestURL,
  getResponseStatus,
  getResponseHeader,
  getQuery,
} from "h3";

// A bogus DATABASE_URL is enough — Prisma only connects on first query, and the
// unit tests never issue one.
process.env.DATABASE_URL ||= "postgresql://test:test@localhost:5432/test";
process.env.NODE_ENV ||= "test";

/** Raw analytics config block, mirroring `runtimeConfig.analytics`. */
export const TEST_ANALYTICS_CONFIG = {
  enabled: true,
  captureEnabled: true,
  abuseEnabled: true,
  aiDetectionEnabled: true,
  rateLimitEnabled: true,
  ipSalt: "test-salt",
  respectDnt: true,
  retentionDays: 30,
  rollupRetentionDays: 365,
  excludePaths: "/_nuxt,/api/health,/api/admin/analytics",
  storageDriver: "memory",
  sessionWindowMinutes: 30,
  rl: {
    ipPerMin: 300,
    authPerMin: 15,
    writePerMin: 90,
    uploadPer5Min: 30,
    userPerMin: 600,
    abusiveMultiplier: 0.2,
    aiThrottleMultiplier: 0.25,
  },
  abuse: {
    floodPerMin: 600,
    errorRate: 0.6,
    distinct404: 12,
    failedLogins: 8,
    suspiciousScore: 40,
    abusiveScore: 75,
    blockMinutes: 30,
  },
  ai: {
    trainingPolicy: "block",
    searchPolicy: "allow",
    liveRetrievalPolicy: "log",
    unknownPolicy: "throttle",
    robotsEnforcement: true,
    ipRangeRefreshHours: 24,
  },
};

vi.stubGlobal("createError", createError);
vi.stubGlobal("getHeader", getHeader);
vi.stubGlobal("getCookie", getCookie);
vi.stubGlobal("setCookie", setCookie);
vi.stubGlobal("setResponseHeader", setResponseHeader);
vi.stubGlobal("getRequestURL", getRequestURL);
vi.stubGlobal("getResponseStatus", getResponseStatus);
vi.stubGlobal("getResponseHeader", getResponseHeader);
vi.stubGlobal("getQuery", getQuery);
vi.stubGlobal("useRuntimeConfig", () => ({ analytics: TEST_ANALYTICS_CONFIG }));
// Nitro task helper — a passthrough is enough to import a task module's exports.
vi.stubGlobal("defineTask", <T>(definition: T): T => definition);

// Minimal in-memory storage shim. The notification service and a few
// other modules reach for `useStorage("analytics")`; tests don't need
// real Nitro storage, just a Map-backed key/value store.
const __testStorage = new Map<string, unknown>();
vi.stubGlobal("useStorage", () => ({
  async getItem<T>(key: string): Promise<T | null> {
    return (__testStorage.get(key) as T) ?? null;
  },
  async setItem(key: string, value: unknown): Promise<void> {
    __testStorage.set(key, value);
  },
  async removeItem(key: string): Promise<void> {
    __testStorage.delete(key);
  },
  async getKeys(): Promise<string[]> {
    return [...__testStorage.keys()];
  },
}));
