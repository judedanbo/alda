import { describe, expect, it } from "vitest";

const {
  normalizeGhanaPhone,
  isValidGhanaPhone,
  ghanaPhoneAlternates,
  normalizePhoneE164,
  isE164Phone,
  isGhanaPhone,
} = await import("~/server/utils/phone");

describe("normalizeGhanaPhone", () => {
  it("rewrites a local 0-prefixed number to +233", () => {
    expect(normalizeGhanaPhone("0201234567")).toBe("+233201234567");
  });

  it("leaves a +233 number untouched", () => {
    expect(normalizeGhanaPhone("+233201234567")).toBe("+233201234567");
  });

  it("strips internal whitespace before normalizing", () => {
    expect(normalizeGhanaPhone("+233 20 123 4567")).toBe("+233201234567");
    expect(normalizeGhanaPhone("020 123 4567")).toBe("+233201234567");
  });
});

describe("isValidGhanaPhone", () => {
  it("accepts +233 and 0 forms", () => {
    expect(isValidGhanaPhone("+233201234567")).toBe(true);
    expect(isValidGhanaPhone("0201234567")).toBe(true);
  });

  it("rejects wrong-length numbers", () => {
    expect(isValidGhanaPhone("+2332012345678")).toBe(false);
    expect(isValidGhanaPhone("020123456")).toBe(false);
  });

  it("rejects numbers starting with 0 or 1 after the prefix", () => {
    expect(isValidGhanaPhone("+233001234567")).toBe(false);
    expect(isValidGhanaPhone("0101234567")).toBe(false);
  });
});

describe("ghanaPhoneAlternates", () => {
  it("returns both forms when given the +233 form", () => {
    expect(ghanaPhoneAlternates("+233201234567").sort()).toEqual(
      ["+233201234567", "0201234567"].sort(),
    );
  });

  it("returns both forms when given the 0 form", () => {
    expect(ghanaPhoneAlternates("0201234567").sort()).toEqual(
      ["+233201234567", "0201234567"].sort(),
    );
  });

  it("treats whitespace-separated forms as equivalent", () => {
    expect(ghanaPhoneAlternates("+233 20 123 4567").sort()).toEqual(
      ghanaPhoneAlternates("020 123 4567").sort(),
    );
  });
});

describe("normalizePhoneE164", () => {
  it("promotes a Ghana local number to +233", () => {
    expect(normalizePhoneE164("0201234567")).toBe("+233201234567");
  });

  it("keeps a Ghana E.164 number intact", () => {
    expect(normalizePhoneE164("+233201234567")).toBe("+233201234567");
  });

  it("accepts a US E.164 number", () => {
    expect(normalizePhoneE164("+14155551234")).toBe("+14155551234");
  });

  it("accepts a UK E.164 number", () => {
    expect(normalizePhoneE164("+447911123456")).toBe("+447911123456");
  });

  it("strips friendly formatting before validating", () => {
    expect(normalizePhoneE164("+1 (415) 555-1234")).toBe("+14155551234");
    expect(normalizePhoneE164("+44 7911 123 456")).toBe("+447911123456");
  });

  it("rejects empty and obviously short inputs", () => {
    expect(normalizePhoneE164("")).toBeNull();
    expect(normalizePhoneE164("12345")).toBeNull();
  });

  it("rejects bare non-Ghana digit strings (ambiguous national vs E.164)", () => {
    // Without a leading + we can't tell if "14155551234" is a US E.164 number
    // missing its + or a Swiss national-format number. Only Ghana's 0XXX form
    // is auto-promoted.
    expect(normalizePhoneE164("14155551234")).toBeNull();
    expect(normalizePhoneE164("4155551234")).toBeNull();
  });
});

describe("isE164Phone", () => {
  it("accepts canonical E.164 across countries", () => {
    expect(isE164Phone("+233201234567")).toBe(true);
    expect(isE164Phone("+14155551234")).toBe(true);
    expect(isE164Phone("+447911123456")).toBe(true);
  });

  it("rejects malformed numbers", () => {
    expect(isE164Phone("not a phone")).toBe(false);
    expect(isE164Phone("+0123456789")).toBe(false);
  });
});

describe("isGhanaPhone", () => {
  it("returns true only for normalized +233 numbers", () => {
    expect(isGhanaPhone("+233201234567")).toBe(true);
    expect(isGhanaPhone("0201234567")).toBe(true);
    expect(isGhanaPhone("+14155551234")).toBe(false);
    expect(isGhanaPhone("+447911123456")).toBe(false);
  });
});
