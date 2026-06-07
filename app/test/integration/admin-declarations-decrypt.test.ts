/**
 * End-to-end check that the projected `select` in admin/declarations.get still
 * carries the *Cipher columns and that decryptProfileIds rehydrates the
 * plaintext national ID — against a real Postgres row encrypted with the
 * test PII keys. Formalizes the manual validation done during the rewrite.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import prisma from "~/server/utils/prisma";
import { seedFixture, KNOWN_GHANA_CARD, type SeededFixture } from "./fixture";

const handler = (await import("~/server/api/admin/declarations.get")).default;

let fx!: SeededFixture;

beforeAll(async () => {
  fx = await seedFixture();
});

afterAll(async () => {
  await prisma.$disconnect();
});

const adminEvent = () =>
  ({ context: { auth: { userId: fx.adminUserId, roles: ["admin"] } } }) as never;

describe("GET /api/admin/declarations (projection + decryption)", () => {
  it("returns the applicant's national ID decrypted from the projected cipher column", async () => {
    const res = await handler(adminEvent());

    expect(res.data.declarations.length).toBe(fx.expectedDeclarationCount);
    const applicant = res.data.declarations[0]!.applicant;
    expect(applicant.ghanaCardNumber).toBe(KNOWN_GHANA_CARD);
    expect(applicant.alternateIdNumber).toBeNull();
    expect(applicant.fullName).toBe("Ama Mensah");
    expect(applicant.offices[0]!.institution?.name).toBe(fx.institutionName);
  });
});
