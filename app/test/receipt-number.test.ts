import { describe, expect, it } from "vitest";

const { generateReceiptNumber } = await import("~/server/services/pdf.service");

describe("generateReceiptNumber", () => {
  it("matches the RCP-YYYY-XXXXXX-XXXXXX shape with hex segments", () => {
    const n = generateReceiptNumber();
    expect(n).toMatch(/^RCP-\d{4}-[0-9A-F]{6}-[0-9A-F]{6}$/);
  });

  it("includes the current year", () => {
    const n = generateReceiptNumber();
    const year = new Date().getFullYear();
    expect(n.startsWith(`RCP-${year}-`)).toBe(true);
  });

  it("is not predictable from the wall clock — 1000 numbers all distinct", () => {
    // H-8 regression. The old implementation used Date.now().slice(-6)
    // + Math.random(), both predictable. With crypto.randomBytes the
    // ~48 bits of entropy per number makes collisions in 1000 samples
    // astronomically unlikely.
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      seen.add(generateReceiptNumber());
    }
    expect(seen.size).toBe(1000);
  });
});
