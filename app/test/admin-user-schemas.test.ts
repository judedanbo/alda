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
      roleNames: ["legal_unit"],
    });
    expect(r.success).toBe(true);
  });

  it("rejects the applicant role (cannot be created by admin)", () => {
    const r = adminCreateUserSchema.safeParse({
      email: "x@adla.gov.gh",
      roleNames: ["applicant"],
    });
    expect(r.success).toBe(false);
  });

  it("requires at least one office for a schedule_officer", () => {
    const r = adminCreateUserSchema.safeParse({
      email: "officer@adla.gov.gh",
      roleNames: ["schedule_officer"],
      collectionOfficeIds: [],
    });
    expect(r.success).toBe(false);
  });

  it("accepts a schedule_officer with an office", () => {
    const r = adminCreateUserSchema.safeParse({
      email: "officer@adla.gov.gh",
      roleNames: ["schedule_officer"],
      collectionOfficeIds: [officeId],
    });
    expect(r.success).toBe(true);
  });

  it("rejects offices assigned to a non-officer", () => {
    const r = adminCreateUserSchema.safeParse({
      email: "legal@adla.gov.gh",
      roleNames: ["legal_unit"],
      collectionOfficeIds: [officeId],
    });
    expect(r.success).toBe(false);
  });

  it("requires at least one role", () => {
    const r = adminCreateUserSchema.safeParse({ email: "x@adla.gov.gh", roleNames: [] });
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

  it("accepts clearing the phone with null", () => {
    expect(adminUpdateUserSchema.safeParse({ phone: null }).success).toBe(true);
  });

  it("rejects an empty payload (nothing to update)", () => {
    expect(adminUpdateUserSchema.safeParse({}).success).toBe(false);
  });

  it("rejects an invalid email", () => {
    expect(adminUpdateUserSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
  });

  it("rejects a non-E.164 phone", () => {
    expect(adminUpdateUserSchema.safeParse({ phone: "0200000000" }).success).toBe(false);
  });
});

describe("acceptInviteSchema", () => {
  it("requires a token", () => {
    expect(acceptInviteSchema.safeParse({ token: "" }).success).toBe(false);
    expect(acceptInviteSchema.safeParse({ token: "abc" }).success).toBe(true);
  });
});
