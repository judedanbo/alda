import { describe, expect, it } from "vitest";

const { applicantProfileSchema } = await import("~/server/utils/validators");

describe("applicantProfileSchema (Ghana Card branch)", () => {
  const base = {
    idType: "GHANA_CARD" as const,
    fullName: "Akosua Mensah",
    ghanaCardNumber: "GHA-123456789-0",
    ghanaCardFrontUrl: "https://example.com/front.jpg",
  };

  it("accepts a valid Ghana Card submission", () => {
    expect(applicantProfileSchema.safeParse(base).success).toBe(true);
  });

  it("rejects a malformed Ghana Card number", () => {
    const result = applicantProfileSchema.safeParse({ ...base, ghanaCardNumber: "123" });
    expect(result.success).toBe(false);
  });

  it("requires the front image", () => {
    const { ghanaCardFrontUrl: _drop, ...withoutFront } = base;
    const result = applicantProfileSchema.safeParse(withoutFront);
    expect(result.success).toBe(false);
  });
});

describe("applicantProfileSchema (alternate-ID branches)", () => {
  const baseAlt = {
    fullName: "Kwame Asante",
    alternateIdScanUrl: "https://example.com/scan.jpg",
    alternateIdReason: "FOREIGN_NATIONAL" as const,
    alternateIdDetails: "Holds a UK passport while seconded to the GAS.",
  };

  it("accepts a passport submission", () => {
    const result = applicantProfileSchema.safeParse({
      ...baseAlt,
      idType: "PASSPORT",
      alternateIdNumber: "G1234567",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a passport with the wrong format", () => {
    const result = applicantProfileSchema.safeParse({
      ...baseAlt,
      idType: "PASSPORT",
      alternateIdNumber: "abc",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a 10-digit voter ID", () => {
    const result = applicantProfileSchema.safeParse({
      ...baseAlt,
      idType: "VOTER_ID",
      alternateIdNumber: "1234567890",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a voter ID that is not 10 digits", () => {
    const result = applicantProfileSchema.safeParse({
      ...baseAlt,
      idType: "VOTER_ID",
      alternateIdNumber: "12345",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a driver's licence in DVLA format", () => {
    const result = applicantProfileSchema.safeParse({
      ...baseAlt,
      idType: "DRIVERS_LICENSE",
      alternateIdNumber: "GR-1234567-22",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an NIA receipt code", () => {
    const result = applicantProfileSchema.safeParse({
      ...baseAlt,
      idType: "NIA_RECEIPT",
      alternateIdNumber: "NIA-2026-ABCDE",
    });
    expect(result.success).toBe(true);
  });

  it("requires a reason on alternate-ID submissions", () => {
    const { alternateIdReason: _drop, ...withoutReason } = baseAlt;
    const result = applicantProfileSchema.safeParse({
      ...withoutReason,
      idType: "PASSPORT",
      alternateIdNumber: "G1234567",
    });
    expect(result.success).toBe(false);
  });

  it("requires a scan URL on alternate-ID submissions", () => {
    const { alternateIdScanUrl: _drop, ...withoutScan } = baseAlt;
    const result = applicantProfileSchema.safeParse({
      ...withoutScan,
      idType: "PASSPORT",
      alternateIdNumber: "G1234567",
    });
    expect(result.success).toBe(false);
  });
});
