import { describe, expect, it } from "vitest";

const { changePasswordSchema, updateContactSchema } = await import("~/server/utils/validators");

describe("changePasswordSchema", () => {
  it("accepts a valid current + new password pair", () => {
    const r = changePasswordSchema.safeParse({
      currentPassword: "whatever",
      newPassword: "NewPass123",
    });
    expect(r.success).toBe(true);
  });

  it("requires a current password", () => {
    const r = changePasswordSchema.safeParse({ currentPassword: "", newPassword: "NewPass123" });
    expect(r.success).toBe(false);
  });

  it("rejects a new password shorter than 8 characters", () => {
    const r = changePasswordSchema.safeParse({ currentPassword: "x", newPassword: "Ab1" });
    expect(r.success).toBe(false);
  });

  it("rejects a new password without an uppercase letter", () => {
    const r = changePasswordSchema.safeParse({ currentPassword: "x", newPassword: "newpass123" });
    expect(r.success).toBe(false);
  });

  it("rejects a new password without a lowercase letter", () => {
    const r = changePasswordSchema.safeParse({ currentPassword: "x", newPassword: "NEWPASS123" });
    expect(r.success).toBe(false);
  });

  it("rejects a new password without a number", () => {
    const r = changePasswordSchema.safeParse({ currentPassword: "x", newPassword: "NewPassword" });
    expect(r.success).toBe(false);
  });
});

describe("updateContactSchema", () => {
  it("accepts an email-only update", () => {
    expect(updateContactSchema.safeParse({ email: "new@adla.gov.gh" }).success).toBe(true);
  });

  it("accepts a phone-only update", () => {
    expect(updateContactSchema.safeParse({ phone: "+233200000000" }).success).toBe(true);
  });

  it("accepts a local Ghana phone (0-prefixed, no country code)", () => {
    expect(updateContactSchema.safeParse({ phone: "0241234567" }).success).toBe(true);
  });

  it("accepts clearing the phone with null", () => {
    expect(updateContactSchema.safeParse({ phone: null }).success).toBe(true);
  });

  it("rejects an empty payload (nothing to update)", () => {
    expect(updateContactSchema.safeParse({}).success).toBe(false);
  });

  it("rejects an invalid email", () => {
    expect(updateContactSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
  });

  it("rejects a malformed phone", () => {
    expect(updateContactSchema.safeParse({ phone: "12345" }).success).toBe(false);
  });
});
