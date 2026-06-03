import { describe, expect, it } from "vitest";

const { extractTbdFields, applyFieldValues, summarizeCoverMeta } = await import(
  "~/server/utils/document-template"
);

const SAMPLE = `# Sample Policy — Asset Declaration Portal (ADLA)

> **Scaffold.** Items marked \`[TBD]\` need owner confirmation.

---

## 0. Document control

| Field | Value |
| --- | --- |
| Version | 0.1 (draft) |
| Owner | \`[TBD]\` (Information Security Officer) |
| Approved by | \`[TBD]\` |

## 1. Objectives

| Objective | Measure (\`[TBD]\` targets) |
| --- | --- |
| Patch quickly | Critical vulns within \`[TBD]\` days. |

Some prose with a value to confirm: \`[TBD]\`.

| # | Risk | Likelihood | Residual |
| --- | --- | --- | --- |
| R1 | Leak | \`[TBD]\` | \`[TBD]\` |
`;

describe("extractTbdFields", () => {
  it("skips the explanatory [TBD] mention in the leading preamble blockquote", () => {
    const fields = extractTbdFields(SAMPLE);
    // The preamble mention must not become a fillable field.
    expect(fields.some((f) => /Items marked/.test(f.context))).toBe(false);
  });

  it("derives labels from the table row's first cell", () => {
    const fields = extractTbdFields(SAMPLE);
    const labels = fields.map((f) => f.label);
    expect(labels).toContain("Owner");
    expect(labels).toContain("Approved by");
  });

  it("captures a parenthetical recommendation after the token", () => {
    const owner = extractTbdFields(SAMPLE).find((f) => f.label === "Owner");
    expect(owner?.recommendation).toBe("Information Security Officer");
  });

  it("includes the column header for wide (>2 col) tables to disambiguate", () => {
    const labels = extractTbdFields(SAMPLE).map((f) => f.label);
    expect(labels).toContain("R1 (Likelihood)");
    expect(labels).toContain("R1 (Residual)");
  });

  it("assigns stable, unique ids", () => {
    const fields = extractTbdFields(SAMPLE);
    const ids = new Set(fields.map((f) => f.id));
    expect(ids.size).toBe(fields.length);
    // Stable across calls.
    expect(extractTbdFields(SAMPLE).map((f) => f.id)).toEqual(fields.map((f) => f.id));
  });

  it("keeps field ordinals aligned with global token positions", () => {
    const fields = extractTbdFields(SAMPLE);
    const allTokens = [...SAMPLE.matchAll(/`?\[TBD[^\]]*\]`?/g)].map((m) => m[0]);
    for (const f of fields) expect(allTokens[f.ordinal]).toBe(f.token);
  });
});

describe("applyFieldValues", () => {
  it("substitutes each placeholder positionally and round-trips with extract", () => {
    const fields = extractTbdFields(SAMPLE);
    const values: Record<string, string> = {};
    for (const f of fields) values[f.id] = `VAL_${f.ordinal}`;

    const filled = applyFieldValues(SAMPLE, values);
    // Every fillable field's value lands in the output.
    for (const f of fields) expect(filled).toContain(`VAL_${f.ordinal}`);
    // Only the skipped preamble mention's [TBD] remains.
    const remaining = (filled.match(/\[TBD/g) ?? []).length;
    const totalTokens = (SAMPLE.match(/\[TBD/g) ?? []).length;
    expect(remaining).toBe(totalTokens - fields.length);
    expect(remaining).toBe(1);
  });

  it("leaves blank/missing values as the original [TBD] token", () => {
    const fields = extractTbdFields(SAMPLE);
    const owner = fields.find((f) => f.label === "Owner")!;
    const filled = applyFieldValues(SAMPLE, { [owner.id]: "" });
    // Nothing was filled, so all original tokens survive.
    expect((filled.match(/\[TBD/g) ?? []).length).toBe((SAMPLE.match(/\[TBD/g) ?? []).length);
  });
});

describe("summarizeCoverMeta", () => {
  it("pulls owner and approver from the filled document-control fields", () => {
    const fields = extractTbdFields(SAMPLE);
    const owner = fields.find((f) => f.label === "Owner")!;
    const approver = fields.find((f) => f.label === "Approved by")!;
    const meta = summarizeCoverMeta(SAMPLE, {
      [owner.id]: "Jane Doe",
      [approver.id]: "John Mensah",
    });
    expect(meta.owner).toBe("Jane Doe");
    expect(meta.approver).toBe("John Mensah");
  });
});
