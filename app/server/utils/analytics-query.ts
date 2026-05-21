import type { H3Event } from "h3";

/**
 * Shared helpers for the admin analytics API: time-range resolution, rollup
 * table selection and numeric coercion for raw-query results.
 */

export type TimeRange = "1h" | "24h" | "7d" | "30d" | "90d";

export interface ResolvedRange {
  range: TimeRange;
  since: Date;
  /** Rollup table to read for this range. */
  table: "traffic_rollup_hourly" | "traffic_rollup_daily";
  grain: "hour" | "day";
}

const RANGE_MS: Record<TimeRange, number> = {
  "1h": 3600_000,
  "24h": 24 * 3600_000,
  "7d": 7 * 24 * 3600_000,
  "30d": 30 * 24 * 3600_000,
  "90d": 90 * 24 * 3600_000,
};

/**
 * Resolves a `range` query parameter into a window + the rollup table that
 * serves it. Short ranges read the hourly rollup for fine granularity; long
 * ranges read the daily rollup to keep row counts small.
 */
export function resolveRange(raw: unknown): ResolvedRange {
  const range: TimeRange = raw === "1h" || raw === "24h" || raw === "7d" || raw === "30d" || raw === "90d"
    ? raw
    : "24h";
  const useHourly = range === "1h" || range === "24h" || range === "7d";
  return {
    range,
    since: new Date(Date.now() - RANGE_MS[range]),
    table: useHourly ? "traffic_rollup_hourly" : "traffic_rollup_daily",
    grain: useHourly ? "hour" : "day",
  };
}

/** Coerces a raw-query scalar (BigInt / Decimal / string) to a finite number. */
export function num(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "bigint" ? Number(value) : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Confirms the caller is an authenticated admin. The `/api/admin` prefix is
 * already role-gated by `server/middleware/auth.ts`; this is a defensive
 * re-check that also narrows the type for handlers.
 */
export function requireAdmin(event: H3Event): { userId: string; email: string; roles: string[] } {
  const auth = event.context.auth;
  if (!auth || !auth.roles?.includes("admin")) {
    throw createError({ statusCode: 403, statusMessage: "Forbidden", message: "Admin role required" });
  }
  return auth;
}
