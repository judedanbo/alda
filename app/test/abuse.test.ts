import { describe, it, expect } from "vitest";
import {
  computeAbuseScore,
  tierForScore,
  isSuspiciousPath,
  recordRequest,
  getEnforcement,
  setEnforcement,
  clearEnforcement,
  type AbuseStats,
} from "../server/utils/abuse";
import { getAnalyticsConfig } from "../server/utils/analytics-config";
import { makeFakeStorage } from "./helpers";

const config = getAnalyticsConfig();

function mkStats(partial: Partial<AbuseStats> = {}): AbuseStats {
  return {
    windowStart: Date.now(),
    requests: 0,
    clientErrors: 0,
    authErrors: 0,
    notFound: 0,
    distinct404: [],
    suspiciousHits: 0,
    failedLogins: 0,
    userAgents: [],
    countries: [],
    contentPages: 0,
    assetRequests: 0,
    lastTier: "ok",
    ...partial,
  };
}

describe("isSuspiciousPath", () => {
  it("flags known scanner/probe targets", () => {
    expect(isSuspiciousPath("/.env")).toBe(true);
    expect(isSuspiciousPath("/wp-admin")).toBe(true);
    expect(isSuspiciousPath("/wp-login.php")).toBe(true);
    expect(isSuspiciousPath("/phpmyadmin/index.php")).toBe(true);
  });
  it("does not flag legitimate application paths", () => {
    expect(isSuspiciousPath("/api/declarations")).toBe(false);
    expect(isSuspiciousPath("/")).toBe(false);
    expect(isSuspiciousPath("/.well-known/security.txt")).toBe(false);
  });
});

describe("computeAbuseScore", () => {
  it("scores clean traffic at zero", () => {
    const { score, reasons } = computeAbuseScore(mkStats({ requests: 30, clientErrors: 1 }), config);
    expect(score).toBe(0);
    expect(reasons).toHaveLength(0);
  });

  it("detects request flooding", () => {
    const { score, reasons } = computeAbuseScore(mkStats({ requests: 10_000 }), config);
    expect(score).toBeGreaterThanOrEqual(40);
    expect(reasons.join(" ")).toContain("flooding");
  });

  it("detects a high 4xx rate", () => {
    const { reasons } = computeAbuseScore(mkStats({ requests: 100, clientErrors: 80 }), config);
    expect(reasons.join(" ")).toContain("4xx");
  });

  it("detects repeated failed logins and path scanning", () => {
    const { score } = computeAbuseScore(
      mkStats({ requests: 50, failedLogins: 9, distinct404: Array.from({ length: 13 }, (_, i) => `/x/${i}`) }),
      config,
    );
    expect(score).toBeGreaterThanOrEqual(55);
  });

  it("caps the score at 100", () => {
    const { score } = computeAbuseScore(
      mkStats({
        requests: 50_000,
        clientErrors: 49_000,
        authErrors: 9_000,
        failedLogins: 99,
        suspiciousHits: 9,
        distinct404: Array.from({ length: 40 }, (_, i) => `/x/${i}`),
        userAgents: ["a", "b", "c", "d", "e"],
        countries: ["GH", "US", "RU", "CN"],
      }),
      config,
    );
    expect(score).toBe(100);
  });
});

describe("tierForScore", () => {
  it("maps scores onto the three response tiers", () => {
    expect(tierForScore(0, config)).toBe("ok");
    expect(tierForScore(45, config)).toBe("log");
    expect(tierForScore(65, config)).toBe("throttle");
    expect(tierForScore(85, config)).toBe("block");
  });
});

describe("recordRequest", () => {
  it("accumulates a rolling window and escalates on probing", async () => {
    const storage = makeFakeStorage();
    const base = {
      ip: "203.0.113.9",
      method: "GET",
      userAgent: "scanner/1.0",
      country: "GH",
      isContentRoute: false,
      isAsset: false,
    };

    let escalatedEver = false;
    // Path scanning: many distinct 404s.
    for (let i = 0; i < 12; i++) {
      const a = await recordRequest(storage, { ...base, path: `/missing/${i}`, statusCode: 404 }, config);
      escalatedEver = escalatedEver || a.escalated;
    }
    // Probing of known-vulnerable paths.
    let last;
    for (let i = 0; i < 3; i++) {
      last = await recordRequest(storage, { ...base, path: "/.env", statusCode: 404 }, config);
      escalatedEver = escalatedEver || last.escalated;
    }

    expect(escalatedEver).toBe(true);
    expect(last!.tier === "throttle" || last!.tier === "block").toBe(true);
    expect(last!.stats.distinct404.length).toBeGreaterThanOrEqual(12);
    expect(last!.stats.suspiciousHits).toBe(3);
  });

  it("counts failed logins from the login route", async () => {
    const storage = makeFakeStorage();
    let last;
    for (let i = 0; i < 5; i++) {
      last = await recordRequest(storage, {
        ip: "203.0.113.10",
        method: "POST",
        path: "/api/auth/login",
        statusCode: 401,
        userAgent: "x",
        country: null,
        isContentRoute: false,
        isAsset: false,
      }, config);
    }
    expect(last!.stats.failedLogins).toBe(5);
  });
});

describe("enforcement state", () => {
  it("stores, reads back and clears enforcement", async () => {
    const storage = makeFakeStorage();
    await setEnforcement(storage, "203.0.113.1", {
      type: "BLOCK",
      reason: "abuse",
      expiresAt: Date.now() + 60_000,
      source: "system",
    });
    expect((await getEnforcement(storage, "203.0.113.1"))?.type).toBe("BLOCK");

    await clearEnforcement(storage, "203.0.113.1");
    expect(await getEnforcement(storage, "203.0.113.1")).toBeNull();
  });

  it("treats expired enforcement as absent", async () => {
    const storage = makeFakeStorage();
    await setEnforcement(storage, "203.0.113.2", {
      type: "THROTTLE",
      reason: "old",
      expiresAt: Date.now() - 1_000,
      source: "system",
    });
    expect(await getEnforcement(storage, "203.0.113.2")).toBeNull();
  });
});
