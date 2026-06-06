import { describe, expect, it } from "vitest";

const {
  maskGhanaCard,
  maskAlternateId,
  maskEmail,
  maskPhone,
  maskFullName,
  maskBucketKey,
  scrubAuditValues,
} = await import("~/server/utils/pii");

describe("maskGhanaCard", () => {
  it("preserves the trailing check digit", () => {
    expect(maskGhanaCard("GHA-123456789-7")).toBe("GHA-XXXXXXXXX-7");
  });
  it("masks a malformed value to the generic placeholder", () => {
    expect(maskGhanaCard("GHA-12-99")).toBe("GHA-XXXXXXXXX-X");
    expect(maskGhanaCard("nonsense")).toBe("GHA-XXXXXXXXX-X");
  });
  it("returns an empty string for null/undefined/empty", () => {
    expect(maskGhanaCard(null)).toBe("");
    expect(maskGhanaCard(undefined)).toBe("");
    expect(maskGhanaCard("")).toBe("");
  });
});

describe("maskAlternateId", () => {
  it("preserves the first character", () => {
    expect(maskAlternateId("A12345678")).toBe("A********");
  });
  it("handles short inputs", () => {
    expect(maskAlternateId("X")).toBe("*");
    expect(maskAlternateId("")).toBe("");
  });
});

describe("maskEmail", () => {
  it("keeps the first character of the local part + the domain", () => {
    expect(maskEmail("john.doe@example.com")).toMatch(/^j\*+@example\.com$/);
  });
  it("never reveals more of the local part than the first character", () => {
    const masked = maskEmail("longusername@example.com");
    expect(masked.startsWith("l*")).toBe(true);
    expect(masked).not.toContain("longusername");
  });
  it("handles short local parts", () => {
    expect(maskEmail("a@b.co")).toBe("a***@b.co");
  });
  it("returns *** for malformed inputs", () => {
    expect(maskEmail("not-an-email")).toBe("***");
    expect(maskEmail("@example.com")).toBe("***");
    expect(maskEmail("user@")).toBe("***");
  });
});

describe("maskPhone", () => {
  it("keeps the first two and last two characters", () => {
    expect(maskPhone("+233201234567")).toBe("+2*********67");
  });
  it("handles short E164 numbers", () => {
    expect(maskPhone("+15555551234")).toBe("+1********34");
  });
  it("works on non-E164 fallbacks", () => {
    expect(maskPhone("0201234567")).toBe("02******67");
    expect(maskPhone("123")).toBe("***");
  });
});

describe("maskFullName", () => {
  it("preserves initials and masks the rest", () => {
    expect(maskFullName("John Doe")).toBe("J*** D**");
  });
  it("handles single names", () => {
    expect(maskFullName("Madonna")).toBe("M******");
  });
  it("collapses internal whitespace", () => {
    expect(maskFullName("  Mary   Anne  Smith  ")).toBe("M*** A*** S****");
  });
});

describe("maskBucketKey", () => {
  it("redacts UUID segments", () => {
    expect(maskBucketKey("ghana-cards/12345678-1234-1234-1234-123456789012/front.jpg"))
      .toBe("ghana-cards/<redacted>/front.jpg");
  });
  it("strips query strings", () => {
    expect(maskBucketKey("receipts/RCP-1.pdf?X-Amz-Signature=abc"))
      .toBe("receipts/RCP-1.pdf");
  });
  it("leaves non-UUID paths intact", () => {
    expect(maskBucketKey("alternate-ids/u/passport.jpg"))
      .toBe("alternate-ids/u/passport.jpg");
  });
});

describe("scrubAuditValues", () => {
  it("returns undefined unchanged", () => {
    expect(scrubAuditValues(undefined)).toBeUndefined();
  });

  it("masks known PII fields and leaves unknown fields alone", () => {
    const scrubbed = scrubAuditValues({
      fullName: "John Doe",
      ghanaCardNumber: "GHA-123456789-4",
      alternateIdNumber: "P9999",
      email: "applicant@example.com",
      phone: "+233201234567",
      verificationStatus: "PENDING_VERIFICATION", // not PII, pass through
      reason: "user_not_found",
    });
    expect(scrubbed).toEqual({
      fullName: "J*** D**",
      ghanaCardNumber: "GHA-XXXXXXXXX-4",
      alternateIdNumber: "P****",
      email: expect.stringMatching(/^a\*+@example\.com$/),
      phone: "+2*********67",
      verificationStatus: "PENDING_VERIFICATION",
      reason: "user_not_found",
    });
  });

  it("preserves null and undefined entries so they remain distinguishable", () => {
    const scrubbed = scrubAuditValues({
      fullName: null,
      ghanaCardNumber: undefined,
      reason: null,
    });
    expect(scrubbed).toEqual({
      fullName: null,
      ghanaCardNumber: undefined,
      reason: null,
    });
  });

  it("redacts bucket-key fields", () => {
    const scrubbed = scrubAuditValues({
      ghanaCardFrontUrl: "ghana-cards/12345678-1234-1234-1234-123456789012/front.jpg",
      letterScanUrl: "reissue-letters/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.pdf",
    });
    expect(scrubbed?.ghanaCardFrontUrl).toBe("ghana-cards/<redacted>/front.jpg");
    expect(scrubbed?.letterScanUrl).toBe("reissue-letters/<redacted>.pdf");
  });

  it("never leaks the original Ghana Card number even when other fields are present", () => {
    const original = "GHA-987654321-1";
    const scrubbed = scrubAuditValues({
      ghanaCardNumber: original,
      uniqueCode: "ADLA-20260525-AB123",
    });
    expect(JSON.stringify(scrubbed)).not.toContain("987654321");
    expect(scrubbed?.uniqueCode).toBe("ADLA-20260525-AB123"); // unique codes are not PII
  });
});
