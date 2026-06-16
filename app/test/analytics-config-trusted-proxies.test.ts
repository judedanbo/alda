import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getAnalyticsConfig,
  resetAnalyticsConfigCache,
} from "../server/utils/analytics-config";
import { TEST_ANALYTICS_CONFIG } from "./setup";

/**
 * `runtimeConfig.analytics.trustedProxies` is an array at build time, but a
 * runtime `NUXT_ANALYTICS_TRUSTED_PROXIES` override (the form used in k8s)
 * arrives as a comma-separated STRING. `getAnalyticsConfig()` must coerce both
 * shapes; otherwise the runtime override silently drops back to `[]` and the
 * app records the ingress pod IP instead of the real client IP.
 */
function withTrustedProxies(value: unknown): string[] {
  vi.stubGlobal("useRuntimeConfig", () => ({
    analytics: { ...TEST_ANALYTICS_CONFIG, trustedProxies: value },
  }));
  resetAnalyticsConfigCache();
  return getAnalyticsConfig().trustedProxies;
}

describe("getAnalyticsConfig trustedProxies coercion", () => {
  afterEach(() => {
    // Restore the default global stub + drop the memo so later tests see config.
    vi.stubGlobal("useRuntimeConfig", () => ({ analytics: TEST_ANALYTICS_CONFIG }));
    resetAnalyticsConfigCache();
  });

  it("parses a comma-separated string (runtime NUXT_ override form)", () => {
    expect(
      withTrustedProxies("10.0.0.0/8, 172.16.0.0/12 ,192.168.0.0/16,fc00::/7"),
    ).toEqual(["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "fc00::/7"]);
  });

  it("still accepts an array (build-time baked form)", () => {
    expect(withTrustedProxies(["10.0.0.0/8", " 172.16.0.0/12 "])).toEqual([
      "10.0.0.0/8",
      "172.16.0.0/12",
    ]);
  });

  it("yields an empty list for empty string / undefined (trust nothing)", () => {
    expect(withTrustedProxies("")).toEqual([]);
    expect(withTrustedProxies(undefined)).toEqual([]);
  });
});
