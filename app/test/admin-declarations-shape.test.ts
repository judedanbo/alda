/**
 * Output-contract guard for admin/declarations.get after the `include` →
 * `select` projection. The critical invariant: the projected query still
 * carries the *Cipher columns so decryptProfileIds can rehydrate the
 * plaintext national IDs the UI expects. Uses the REAL pii-encryption module
 * (mint ciphertext with encryptPii, assert the handler decrypts it back).
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Dev-marker PII keys must be set before pii-encryption reads process.env.
process.env.PII_ENCRYPTION_KEY ||=
  "00000000000000000000000000000000000000000000000000000000000000ff";
process.env.PII_HMAC_KEY ||=
  "00000000000000000000000000000000000000000000000000000000000000aa";

const prismaMock = vi.hoisted(() => ({
  userRole: { findMany: vi.fn() },
  declaration: { findMany: vi.fn(), count: vi.fn() },
}));
const getQueryMock = vi.hoisted(() => vi.fn());

vi.mock("~/server/utils/prisma", () => ({ default: prismaMock }));
vi.stubGlobal("getQuery", getQueryMock);

const { encryptPii } = await import("~/server/utils/pii-encryption"); // REAL, not mocked
const handler = (await import("~/server/api/admin/declarations.get")).default;

const KNOWN_GHANA_CARD = "GHA-000111-2";
let ghanaCardCipher: string;

beforeAll(() => {
  ghanaCardCipher = encryptPii(KNOWN_GHANA_CARD);
});

const adminEvent = () =>
  ({ context: { auth: { userId: "admin-1", roles: ["admin"] } } }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  getQueryMock.mockReturnValue({});
  prismaMock.userRole.findMany.mockResolvedValue([{ role: { name: "admin" } }]);
  prismaMock.declaration.count.mockResolvedValue(1);
  prismaMock.declaration.findMany.mockResolvedValue([
    {
      id: "decl-1",
      uniqueCode: "ADLA-0001",
      status: "SUBMITTED",
      submittedAt: new Date("2026-01-02T00:00:00Z"),
      createdAt: new Date("2026-01-01T00:00:00Z"),
      applicant: {
        fullName: "Ama Mensah",
        idType: "GHANA_CARD",
        ghanaCardNumberCipher: ghanaCardCipher,
        alternateIdNumberCipher: null,
        offices: [
          {
            id: "office-1",
            designation: "Director",
            startDate: new Date("2020-01-01"),
            endDate: null,
            officeCategory: { name: "Chief Director" },
            institution: { name: "Ghana Health Service" },
          },
        ],
        user: { email: "ama@example.gh", phone: "+233200000000" },
      },
      formCollections: [
        { collectedAt: new Date("2026-01-03T00:00:00Z"), collectionOffice: { name: "Accra Office" }, notes: null },
      ],
      formReissueRequests: [],
      sectionReviews: [],
      reviews: [],
      receipts: [],
    },
  ]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/admin/declarations", () => {
  it("403s for a non-admin caller", async () => {
    prismaMock.userRole.findMany.mockResolvedValue([{ role: { name: "applicant" } }]);
    await expect(handler(adminEvent())).rejects.toMatchObject({ statusCode: 403 });
  });

  it("decrypts the projected *Cipher columns back to plaintext national IDs", async () => {
    const res = await handler(adminEvent());

    const applicant = res.data.declarations[0].applicant;
    expect(applicant.ghanaCardNumber).toBe(KNOWN_GHANA_CARD);
    expect(applicant.alternateIdNumber).toBeNull();
    // The projected fields the UI reads are all present.
    expect(applicant.fullName).toBe("Ama Mensah");
    expect(applicant.idType).toBe("GHANA_CARD");
    expect(applicant.offices[0]).toMatchObject({
      designation: "Director",
      officeCategory: { name: "Chief Director" },
      institution: { name: "Ghana Health Service" },
    });
    expect(applicant.user).toEqual({ email: "ama@example.gh", phone: "+233200000000" });
  });

  it("maps the nested relations and counts", async () => {
    const res = await handler(adminEvent());

    const d = res.data.declarations[0];
    expect(d).toMatchObject({
      id: "decl-1",
      uniqueCode: "ADLA-0001",
      status: "SUBMITTED",
      formCollection: { officeName: "Accra Office", notes: null },
      review: null,
      receipt: null,
    });
    expect(d.formReissues).toEqual([]);
    expect(d.sectionReviews).toEqual([]);
    expect(res.data.total).toBe(1);
  });
});
