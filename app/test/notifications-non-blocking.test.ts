/**
 * Regression guard for the "notifications off the response path" change.
 *
 * Every state-changing handler now wraps its notification dispatch in
 * runAfterResponse(...) instead of `await`-ing it. These tests use the REAL
 * runAfterResponse with a notification mock that never resolves: if a handler
 * resolves anyway, the notification is genuinely detached; if someone re-adds
 * an `await`, the handler hangs and the test times out — which is the signal.
 *
 * Two handlers cover both wrapping styles:
 *   - reviews/approve.post       → runAfterResponse(sendNotification(...))
 *   - declarations/index.post    → runAfterResponse(notifyUniqueCodeGenerated(...))
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  userRole: { findMany: vi.fn() },
  applicantProfile: { findUnique: vi.fn() },
  declaration: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  $transaction: vi.fn(),
}));
const validateBodyMock = vi.hoisted(() => vi.fn());
const logActionMock = vi.hoisted(() => vi.fn());
const createAuditLogMock = vi.hoisted(() => vi.fn());
const assertOfficerScopeMock = vi.hoisted(() => vi.fn());
const generateUniqueCodeMock = vi.hoisted(() => vi.fn());
const sendNotificationMock = vi.hoisted(() => vi.fn());
const notifyUniqueCodeGeneratedMock = vi.hoisted(() => vi.fn());

vi.mock("~/server/utils/prisma", () => ({ default: prismaMock }));
vi.mock("~/server/utils/validators", async () => {
  const actual = await vi.importActual<typeof import("~/server/utils/validators")>(
    "~/server/utils/validators",
  );
  return { ...actual, validateBody: validateBodyMock };
});
vi.mock("~/server/utils/audit", async () => {
  const actual = await vi.importActual<typeof import("~/server/utils/audit")>(
    "~/server/utils/audit",
  );
  return { ...actual, logAction: logActionMock, createAuditLog: createAuditLogMock, logAudit: createAuditLogMock };
});
vi.mock("~/server/utils/officer-scope", () => ({
  assertOfficerCanActOnDeclaration: assertOfficerScopeMock,
}));
vi.mock("~/server/utils/code-generator", () => ({
  generateUniqueCode: generateUniqueCodeMock,
}));
vi.mock("~/server/services/notification.service", () => ({
  sendNotification: sendNotificationMock,
  notifyUniqueCodeGenerated: notifyUniqueCodeGeneratedMock,
}));
// NOTE: ~/server/utils/after-response is intentionally NOT mocked.

const approveHandler = (await import("~/server/api/reviews/approve.post")).default;
const createDeclarationHandler = (await import("~/server/api/declarations/index.post")).default;

// A promise that never settles — stands in for a slow notification.
const pendingForever = () => new Promise<void>(() => {});

function authEvent(userId = "user-1") {
  return {
    path: "/api/test",
    node: { req: { headers: {}, url: "/api/test" } },
    context: { auth: { userId, email: "x@example.com", roles: ["admin"] } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();

  // reviews/approve happy-path doubles
  prismaMock.userRole.findMany.mockResolvedValue([{ role: { name: "admin" } }]);
  validateBodyMock.mockResolvedValue({ declarationId: "decl-1" });
  prismaMock.declaration.findUnique.mockResolvedValue({
    id: "decl-1",
    status: "UNDER_REVIEW",
    uniqueCode: "ADLA-0001",
    sectionReviews: [],
    applicant: { fullName: "Ama Mensah", user: { id: "applicant-user-1" } },
  });
  assertOfficerScopeMock.mockResolvedValue(undefined);
  prismaMock.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb({
      review: { create: vi.fn().mockResolvedValue({ id: "review-1" }) },
      declaration: { update: vi.fn().mockResolvedValue({}) },
      declarationStatusHistory: { create: vi.fn().mockResolvedValue({}) },
    }),
  );
  logActionMock.mockResolvedValue(undefined);

  // declarations/index happy-path doubles
  prismaMock.applicantProfile.findUnique.mockResolvedValue({
    id: "profile-1",
    fullName: "Ama Mensah",
    verificationStatus: "VERIFIED",
    user: { emailVerified: true, phoneVerified: true },
  });
  prismaMock.declaration.findFirst.mockResolvedValue(null);
  generateUniqueCodeMock.mockReturnValue("ADLA-NEW1");
  // declaration.findUnique is reused for the uniqueness check (must be null there);
  // the approve test overrides it in-test, so set the uniqueness default per-test.
  prismaMock.declaration.create.mockResolvedValue({
    id: "decl-new",
    uniqueCode: "ADLA-NEW1",
    status: "CODE_GENERATED",
    createdAt: new Date("2026-01-01T00:00:00Z"),
  });
  createAuditLogMock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("reviews/approve.post — notification is off the response path", () => {
  it("resolves the response even while the notification never settles", async () => {
    sendNotificationMock.mockReturnValue(pendingForever());

    const res = await approveHandler(authEvent());

    expect(res).toMatchObject({ success: true, data: { review: { id: "review-1" } } });
    expect(sendNotificationMock).toHaveBeenCalledTimes(1);
  });

  it("dispatches the REVIEW_APPROVED notification with the expected payload", async () => {
    sendNotificationMock.mockResolvedValue(undefined);

    await approveHandler(authEvent());

    const payload = sendNotificationMock.mock.calls[0]![0];
    expect(payload).toMatchObject({
      userId: "applicant-user-1",
      type: "REVIEW_APPROVED",
      dedupeKey: "ADLA-0001",
    });
  });

  it("does not fail the request when the notification rejects", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    sendNotificationMock.mockRejectedValue(new Error("notify down"));

    const res = await approveHandler(authEvent());

    expect(res).toMatchObject({ success: true });
    await new Promise((r) => setTimeout(r, 0));
    expect(errSpy).toHaveBeenCalled(); // swallowed + logged, not thrown
  });
});

describe("declarations/index.post — notifyX wrapper is off the response path", () => {
  beforeEach(() => {
    // uniqueness probe must return null so the generated code is accepted
    prismaMock.declaration.findUnique.mockResolvedValue(null);
  });

  it("resolves the response even while the notification never settles", async () => {
    notifyUniqueCodeGeneratedMock.mockReturnValue(pendingForever());

    const res = await createDeclarationHandler(authEvent());

    expect(res).toMatchObject({ success: true, data: { uniqueCode: "ADLA-NEW1" } });
    expect(notifyUniqueCodeGeneratedMock).toHaveBeenCalledWith(
      "user-1",
      "ADLA-NEW1",
      "Ama Mensah",
    );
  });

  it("does not fail the request when the notification rejects", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    notifyUniqueCodeGeneratedMock.mockRejectedValue(new Error("notify down"));

    const res = await createDeclarationHandler(authEvent());

    expect(res).toMatchObject({ success: true });
    await new Promise((r) => setTimeout(r, 0));
    expect(errSpy).toHaveBeenCalled();
  });
});
