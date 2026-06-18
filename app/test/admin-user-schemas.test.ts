import { describe, expect, it } from "vitest";

const {
  adminCreateUserSchema,
  adminUserOfficesSchema,
  adminUpdateUserSchema,
  acceptInviteSchema,
} = await import("~/server/utils/validators");

const officeId = "11111111-1111-1111-1111-111111111111";

describe("adminCreateUserSchema", () => {
  it("accepts a legal_unit user with no offices", () => {
    const r = adminCreateUserSchema.safeParse({
      email: "legal@adla.gov.gh",
      fullName: "Kojo Legal",
      roleNames: ["legal_unit"],
    });
    expect(r.success).toBe(true);
  });

  it("requires a full name", () => {
    const r = adminCreateUserSchema.safeParse({
      email: "legal@adla.gov.gh",
      roleNames: ["legal_unit"],
    });
    expect(r.success).toBe(false);
  });

  it("rejects a too-short full name", () => {
    const r = adminCreateUserSchema.safeParse({
      email: "legal@adla.gov.gh",
      fullName: "A",
      roleNames: ["legal_unit"],
    });
    expect(r.success).toBe(false);
  });

  it("trims the full name", () => {
    const r = adminCreateUserSchema.safeParse({
      email: "legal@adla.gov.gh",
      fullName: "  Kojo Legal  ",
      roleNames: ["legal_unit"],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.fullName).toBe("Kojo Legal");
  });

  it("rejects the applicant role (cannot be created by admin)", () => {
    const r = adminCreateUserSchema.safeParse({
      email: "x@adla.gov.gh",
      fullName: "Test User",
      roleNames: ["applicant"],
    });
    expect(r.success).toBe(false);
  });

  it("requires at least one office for a schedule_officer", () => {
    const r = adminCreateUserSchema.safeParse({
      email: "officer@adla.gov.gh",
      fullName: "Yaw Officer",
      roleNames: ["schedule_officer"],
      collectionOfficeIds: [],
    });
    expect(r.success).toBe(false);
  });

  it("accepts a schedule_officer with an office", () => {
    const r = adminCreateUserSchema.safeParse({
      email: "officer@adla.gov.gh",
      fullName: "Yaw Officer",
      roleNames: ["schedule_officer"],
      collectionOfficeIds: [officeId],
    });
    expect(r.success).toBe(true);
  });

  it("rejects offices assigned to a non-officer", () => {
    const r = adminCreateUserSchema.safeParse({
      email: "legal@adla.gov.gh",
      fullName: "Kojo Legal",
      roleNames: ["legal_unit"],
      collectionOfficeIds: [officeId],
    });
    expect(r.success).toBe(false);
  });

  it("accepts a local Ghana phone (0-prefixed, no country code)", () => {
    const r = adminCreateUserSchema.safeParse({
      email: "legal@adla.gov.gh",
      fullName: "Kojo Legal",
      roleNames: ["legal_unit"],
      phone: "0241234567",
    });
    expect(r.success).toBe(true);
  });

  it("requires at least one role", () => {
    const r = adminCreateUserSchema.safeParse({
      email: "x@adla.gov.gh",
      fullName: "Test User",
      roleNames: [],
    });
    expect(r.success).toBe(false);
  });
});

describe("adminUserOfficesSchema", () => {
  it("accepts an empty office list (clearing scope)", () => {
    expect(adminUserOfficesSchema.safeParse({ collectionOfficeIds: [] }).success).toBe(true);
  });
  it("rejects non-uuid office ids", () => {
    expect(adminUserOfficesSchema.safeParse({ collectionOfficeIds: ["nope"] }).success).toBe(false);
  });
});

describe("adminUpdateUserSchema", () => {
  it("accepts an email-only update", () => {
    expect(adminUpdateUserSchema.safeParse({ email: "new@adla.gov.gh" }).success).toBe(true);
  });

  it("accepts a phone-only update", () => {
    expect(adminUpdateUserSchema.safeParse({ phone: "+233200000000" }).success).toBe(true);
  });

  it("accepts a full-name-only update", () => {
    expect(adminUpdateUserSchema.safeParse({ fullName: "New Name" }).success).toBe(true);
  });

  it("rejects a too-short full name", () => {
    expect(adminUpdateUserSchema.safeParse({ fullName: "A" }).success).toBe(false);
  });

  it("accepts clearing the phone with null", () => {
    expect(adminUpdateUserSchema.safeParse({ phone: null }).success).toBe(true);
  });

  it("rejects an empty payload (nothing to update)", () => {
    expect(adminUpdateUserSchema.safeParse({}).success).toBe(false);
  });

  it("rejects an invalid email", () => {
    expect(adminUpdateUserSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
  });

  it("accepts a local Ghana phone (0-prefixed, no country code)", () => {
    expect(adminUpdateUserSchema.safeParse({ phone: "0200000000" }).success).toBe(true);
  });

  it("rejects a malformed phone", () => {
    expect(adminUpdateUserSchema.safeParse({ phone: "12345" }).success).toBe(false);
  });
});

describe("acceptInviteSchema", () => {
  it("requires a token", () => {
    expect(acceptInviteSchema.safeParse({ token: "" }).success).toBe(false);
    expect(acceptInviteSchema.safeParse({ token: "abc" }).success).toBe(true);
  });
});
