import { describe, expect, it } from "vitest";
import { formatBytes } from "~/utils/formatBytes";

describe("formatBytes", () => {
  it("renders sub-kilobyte sizes in bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1023)).toBe("1023 B");
  });

  it("renders kilobytes with no decimals", () => {
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("2 KB"); // rounds
    expect(formatBytes(1024 * 1023)).toBe("1023 KB");
  });

  it("renders megabytes with one decimal", () => {
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
    expect(formatBytes(1.5 * 1024 * 1024)).toBe("1.5 MB");
    expect(formatBytes(10 * 1024 * 1024)).toBe("10.0 MB");
  });
});
