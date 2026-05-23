/**
 * Phone formatting & validation tests for the Ghana-specific SMS service.
 * These are pure functions so no mocking is needed.
 */
import { describe, expect, it } from "vitest";

const { formatGhanaPhone, isValidGhanaPhone, SmsTemplates } = await import(
  "~/server/services/sms.service"
);

describe("formatGhanaPhone", () => {
  it("strips formatting characters", () => {
    expect(formatGhanaPhone("(024) 123-4567")).toBe("233241234567");
  });

  it("converts 0-prefixed local numbers to international", () => {
    expect(formatGhanaPhone("0241234567")).toBe("233241234567");
  });

  it("preserves already-international numbers", () => {
    expect(formatGhanaPhone("233241234567")).toBe("233241234567");
  });

  it("adds 233 prefix when no leading 0 or 233", () => {
    expect(formatGhanaPhone("241234567")).toBe("233241234567");
  });

  it("strips +", () => {
    expect(formatGhanaPhone("+233241234567")).toBe("233241234567");
  });

  it("handles spaced input", () => {
    expect(formatGhanaPhone("0 24 123 4567")).toBe("233241234567");
  });
});

describe("isValidGhanaPhone", () => {
  it("accepts well-formed local numbers", () => {
    expect(isValidGhanaPhone("0241234567")).toBe(true);
    expect(isValidGhanaPhone("0501234567")).toBe(true);
  });

  it("accepts international numbers", () => {
    expect(isValidGhanaPhone("233241234567")).toBe(true);
  });

  it("rejects too-short numbers", () => {
    expect(isValidGhanaPhone("02412345")).toBe(false);
  });

  it("rejects too-long numbers", () => {
    expect(isValidGhanaPhone("0241234567890")).toBe(false);
  });

  it("rejects numbers starting with 0/1 in operator code", () => {
    // The regex requires [2-9] after 233.
    expect(isValidGhanaPhone("233141234567")).toBe(false);
    expect(isValidGhanaPhone("233041234567")).toBe(false);
  });

  it("rejects empty input", () => {
    expect(isValidGhanaPhone("")).toBe(false);
  });
});

describe("SmsTemplates", () => {
  it("formats the unique-code SMS", () => {
    expect(SmsTemplates.uniqueCode("ADLA-123")).toContain("ADLA-123");
    expect(SmsTemplates.uniqueCode("ADLA-123")).toMatch(/Keep this code safe/);
  });

  it("formats the OTP SMS without leaking the code into a URL", () => {
    const msg = SmsTemplates.otp("482915");
    expect(msg).toContain("482915");
    expect(msg).not.toContain("http");
  });

  it("references the declaration code in approved/rejected SMS", () => {
    expect(SmsTemplates.declarationApproved("XYZ-1")).toContain("XYZ-1");
    expect(SmsTemplates.declarationRejected("XYZ-1")).toContain("XYZ-1");
    expect(SmsTemplates.pickupReady("XYZ-1")).toContain("XYZ-1");
  });
});
