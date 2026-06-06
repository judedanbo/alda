import { describe, it, expect, beforeEach, vi } from "vitest";
import type { H3Event } from "h3";

/**
 * Mock Prisma at module load so the helper's `prisma.userCollectionOffice
 * .findFirst` and `prisma.formCollection.findFirst` calls go through the
 * test doubles below. The helper is otherwise pure logic over
 * `event.context.auth` + Prisma results.
 */
const mockUserOffice = vi.fn();
const mockFormCollection = vi.fn();

vi.mock("~/server/utils/prisma", () => ({
  default: {
    userCollectionOffice: { findFirst: mockUserOffice },
    formCollection: { findFirst: mockFormCollection },
  },
}));

const { assertOfficerCanActOnOffice, assertOfficerCanActOnDeclaration } = await import(
  "~/server/utils/officer-scope"
);

function eventWith(auth: { userId: string; roles: string[] } | null): H3Event {
  return { context: { auth: auth ?? undefined } } as unknown as H3Event;
}

beforeEach(() => {
  mockUserOffice.mockReset();
  mockFormCollection.mockReset();
});

describe("assertOfficerCanActOnOffice", () => {
  it("throws 401 when there's no auth", async () => {
    await expect(assertOfficerCanActOnOffice(eventWith(null), "office-1"))
      .rejects.toMatchObject({ statusCode: 401 });
    expect(mockUserOffice).not.toHaveBeenCalled();
  });

  it("returns without querying Prisma when the actor is an admin", async () => {
    await assertOfficerCanActOnOffice(
      eventWith({ userId: "u-admin", roles: ["admin"] }),
      "office-1",
    );
    expect(mockUserOffice).not.toHaveBeenCalled();
  });

  it("returns when the officer is assigned to the target office", async () => {
    mockUserOffice.mockResolvedValueOnce({ userId: "u-1" });
    await assertOfficerCanActOnOffice(
      eventWith({ userId: "u-1", roles: ["schedule_officer"] }),
      "office-1",
    );
    expect(mockUserOffice).toHaveBeenCalledWith({
      where: { userId: "u-1", collectionOfficeId: "office-1" },
      select: { userId: true },
    });
  });

  it("throws 403 when the officer has no assignment to the target office", async () => {
    mockUserOffice.mockResolvedValueOnce(null);
    await expect(
      assertOfficerCanActOnOffice(
        eventWith({ userId: "u-1", roles: ["schedule_officer"] }),
        "office-other",
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe("assertOfficerCanActOnDeclaration", () => {
  it("admin bypass — no Prisma calls at all", async () => {
    await assertOfficerCanActOnDeclaration(
      eventWith({ userId: "u-admin", roles: ["admin"] }),
      "decl-1",
    );
    expect(mockFormCollection).not.toHaveBeenCalled();
    expect(mockUserOffice).not.toHaveBeenCalled();
  });

  it("derives the office from the latest FormCollection then checks assignment", async () => {
    mockFormCollection.mockResolvedValueOnce({ collectionOfficeId: "office-7" });
    mockUserOffice.mockResolvedValueOnce({ userId: "u-1" });

    await assertOfficerCanActOnDeclaration(
      eventWith({ userId: "u-1", roles: ["schedule_officer"] }),
      "decl-1",
    );

    expect(mockFormCollection).toHaveBeenCalledWith({
      where: { declarationId: "decl-1" },
      orderBy: { createdAt: "desc" },
      select: { collectionOfficeId: true },
    });
    expect(mockUserOffice).toHaveBeenCalledWith({
      where: { userId: "u-1", collectionOfficeId: "office-7" },
      select: { userId: true },
    });
  });

  it("throws 404 when the declaration has no FormCollection at all", async () => {
    mockFormCollection.mockResolvedValueOnce(null);
    await expect(
      assertOfficerCanActOnDeclaration(
        eventWith({ userId: "u-1", roles: ["schedule_officer"] }),
        "decl-orphan",
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mockUserOffice).not.toHaveBeenCalled();
  });

  it("throws 403 when the declaration's office isn't in the officer's assignments", async () => {
    mockFormCollection.mockResolvedValueOnce({ collectionOfficeId: "office-7" });
    mockUserOffice.mockResolvedValueOnce(null);
    await expect(
      assertOfficerCanActOnDeclaration(
        eventWith({ userId: "u-1", roles: ["schedule_officer"] }),
        "decl-1",
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("throws 401 when there's no auth", async () => {
    await expect(
      assertOfficerCanActOnDeclaration(eventWith(null), "decl-1"),
    ).rejects.toMatchObject({ statusCode: 401 });
    expect(mockFormCollection).not.toHaveBeenCalled();
  });
});
