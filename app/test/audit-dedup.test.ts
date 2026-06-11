import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Unit coverage for the audit-log coverage hardening:
 *
 *  - `createAuditLogOnce` throttles high-volume security events (rate-limit
 *    breaches, AI-agent blocks) to ~one row per (action, key) window via the
 *    analytics KV, and fails OPEN to logging when the KV is unavailable.
 *  - The `AuditActions` registry exposes the new sensitive-read actions and
 *    the two legacy uppercase values are normalized to snake_case.
 *
 * Prisma is mocked (same pattern as test/audit-queue.test.ts) so the inline
 * write path lands on a test double; analytics-storage is mocked with a Map
 * so dedup markers are observable without a real Redis/Nitro runtime.
 */

const mockCreate = vi.fn();
vi.mock("~/server/utils/prisma", () => ({
  default: { auditLog: { create: mockCreate } },
}));

// In-memory stand-in for the analytics KV. `storageAvailable` lets a test
// simulate `getAnalyticsStorage()` throwing (Nitro mount absent).
const kv = new Map<string, unknown>();
let storageAvailable = true;
vi.mock("~/server/utils/analytics-storage", () => ({
  getAnalyticsStorage: () => {
    if (!storageAvailable) throw new Error("no analytics mount");
    return {};
  },
  safeGet: async (_s: unknown, key: string) => kv.get(key) ?? null,
  safeSet: async (_s: unknown, key: string, value: unknown) => {
    kv.set(key, value);
  },
}));

const { createAuditLogOnce, logAudit, logAuditOnce, AuditActions } = await import(
  "~/server/utils/audit"
);

const fakeEvent = () => ({}) as never;

beforeEach(() => {
  mockCreate.mockReset();
  mockCreate.mockResolvedValue({ id: "audit-row-id" });
  kv.clear();
  storageAvailable = true;
});

describe("createAuditLogOnce", () => {
  const data = {
    action: AuditActions.RATE_LIMIT_EXCEEDED,
    entityType: "ip",
    entityId: "1.2.3.4",
    newValues: { scope: "client_ip" },
  };

  it("writes the first event and suppresses duplicates within the window", async () => {
    const first = await createAuditLogOnce(fakeEvent(), data, { key: "1.2.3.4" });
    const second = await createAuditLogOnce(fakeEvent(), data, { key: "1.2.3.4" });

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("logs separately for a different dedupe key", async () => {
    await createAuditLogOnce(fakeEvent(), data, { key: "1.2.3.4" });
    const other = await createAuditLogOnce(fakeEvent(), data, { key: "5.6.7.8" });

    expect(other).toBe(true);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("dedupes per action — a different action under the same key still logs", async () => {
    await createAuditLogOnce(fakeEvent(), data, { key: "1.2.3.4" });
    const spoof = await createAuditLogOnce(
      fakeEvent(),
      { ...data, action: AuditActions.AI_AGENT_SPOOFED },
      { key: "1.2.3.4" },
    );

    expect(spoof).toBe(true);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("fails open to logging when the analytics KV is unavailable", async () => {
    storageAvailable = false;

    const first = await createAuditLogOnce(fakeEvent(), data, { key: "1.2.3.4" });
    const second = await createAuditLogOnce(fakeEvent(), data, { key: "1.2.3.4" });

    // Without a KV there is no dedup marker, so both write — better a
    // duplicate row than a dropped security event.
    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });
});

describe("logAudit / logAuditOnce (detached from the response path)", () => {
  it("logAudit returns void (fire-and-forget) and the write still lands", async () => {
    // Returning `undefined` rather than a Promise is the latency contract:
    // the calling handler cannot (and does not) await the audit I/O.
    const ret = logAudit(fakeEvent(), {
      action: AuditActions.APPLICANT_PII_VIEWED,
      entityType: "applicant_profile",
      entityId: "p-1",
    });

    expect(ret).toBeUndefined();
    await vi.waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
  });

  it("logAuditOnce returns void and the deduped write still lands", async () => {
    const ret = logAuditOnce(
      fakeEvent(),
      { action: AuditActions.RATE_LIMIT_EXCEEDED, entityType: "ip", entityId: "1.2.3.4" },
      { key: "1.2.3.4" },
    );

    expect(ret).toBeUndefined();
    await vi.waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
  });
});

describe("AuditActions registry", () => {
  it("normalizes the legacy code-verification values to snake_case", () => {
    expect(AuditActions.CODE_VERIFIED).toBe("code_verified");
    expect(AuditActions.CODE_VERIFICATION_FAILED).toBe("code_verification_failed");
  });

  it("exposes the new sensitive-read and mutating-gap actions", () => {
    expect(AuditActions.APPLICANT_PII_VIEWED).toBe("applicant_pii_viewed");
    expect(AuditActions.DECLARATION_EXPORTED).toBe("declaration_exported");
    expect(AuditActions.AUDIT_LOG_VIEWED).toBe("audit_log_viewed");
    expect(AuditActions.FILE_DOWNLOADED).toBe("file_downloaded");
    expect(AuditActions.NOTIFICATION_PREFERENCES_UPDATED).toBe(
      "notification_preferences_updated",
    );
    expect(AuditActions.CONTACT_SUBMITTED).toBe("contact_submitted");
  });
});
