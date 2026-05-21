import { describe, it, expect } from "vitest";
import { resolveRange, num } from "../server/utils/analytics-query";
import { rollupSql } from "../server/tasks/analytics/rollup";

describe("resolveRange", () => {
  it("serves short ranges from the hourly rollup", () => {
    expect(resolveRange("1h").table).toBe("traffic_rollup_hourly");
    expect(resolveRange("24h").table).toBe("traffic_rollup_hourly");
    expect(resolveRange("7d").table).toBe("traffic_rollup_hourly");
    expect(resolveRange("24h").grain).toBe("hour");
  });

  it("serves long ranges from the daily rollup", () => {
    expect(resolveRange("30d").table).toBe("traffic_rollup_daily");
    expect(resolveRange("90d").table).toBe("traffic_rollup_daily");
    expect(resolveRange("30d").grain).toBe("day");
  });

  it("defaults unknown input to 24h", () => {
    expect(resolveRange(undefined).range).toBe("24h");
    expect(resolveRange("nonsense").range).toBe("24h");
  });

  it("computes a since-date in the past", () => {
    expect(resolveRange("24h").since.getTime()).toBeLessThan(Date.now());
  });
});

describe("num", () => {
  it("coerces BigInt, string and null query scalars to numbers", () => {
    expect(num(42n)).toBe(42);
    expect(num("17")).toBe(17);
    expect(num(3.5)).toBe(3.5);
    expect(num(null)).toBe(0);
    expect(num(undefined)).toBe(0);
    expect(num("not-a-number")).toBe(0);
  });
});

describe("rollupSql", () => {
  const { del, ins } = rollupSql(
    "traffic_rollup_hourly",
    "date_trunc('hour', now()) - interval '3 hours'",
    "date_trunc('hour', occurred_at)",
  );

  it("builds an idempotent delete for the trailing window", () => {
    expect(del).toContain("DELETE FROM traffic_rollup_hourly");
    expect(del).toContain("WHERE bucket >=");
  });

  it("aggregates the additive metrics and percentiles correctly", () => {
    expect(ins).toContain("INSERT INTO traffic_rollup_hourly");
    expect(ins).toContain("percentile_cont(0.95)");
    expect(ins).toContain("COUNT(DISTINCT visitor_id)");
    expect(ins).toContain("COUNT(DISTINCT session_id)");
    expect(ins).toContain("FILTER (WHERE status_code >= 400 AND status_code < 500)");
    expect(ins).toContain("FILTER (WHERE status_code >= 500)");
    expect(ins).toContain("FILTER (WHERE is_new_visitor)");
  });

  it("groups by all nine rollup dimensions", () => {
    expect(ins).toContain("GROUP BY 2, 3, 4, 5, 6, 7, 8, 9, 10");
  });
});
