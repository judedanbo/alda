/**
 * Phone formatting & validation tests for the Ghana-specific SMS service.
 * These are pure functions so no mocking is needed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { formatGhanaPhone, isValidGhanaPhone, sendSms } = await import(
  "~/server/services/sms.service"
);

describe("formatGhanaPhone", () => {
  it("strips formatting characters", () => {
    expect(formatGhanaPhone("(024) 123-4567")).toBe("233241234567");
  });

  it("converts 0-prefixed local numbers to international", () => {
    expect(formatGhanaPhone("0241234567")).toBe("233241234567");
  });

  it("preserves already-international numbers", () => {
    expect(formatGhanaPhone("233241234567")).toBe("233241234567");
  });

  it("adds 233 prefix when no leading 0 or 233", () => {
    expect(formatGhanaPhone("241234567")).toBe("233241234567");
  });

  it("strips +", () => {
    expect(formatGhanaPhone("+233241234567")).toBe("233241234567");
  });

  it("handles spaced input", () => {
    expect(formatGhanaPhone("0 24 123 4567")).toBe("233241234567");
  });
});

describe("isValidGhanaPhone", () => {
  it("accepts well-formed local numbers", () => {
    expect(isValidGhanaPhone("0241234567")).toBe(true);
    expect(isValidGhanaPhone("0501234567")).toBe(true);
  });

  it("accepts international numbers", () => {
    expect(isValidGhanaPhone("233241234567")).toBe(true);
  });

  it("rejects too-short numbers", () => {
    expect(isValidGhanaPhone("02412345")).toBe(false);
  });

  it("rejects too-long numbers", () => {
    expect(isValidGhanaPhone("0241234567890")).toBe(false);
  });

  it("rejects numbers starting with 0/1 in operator code", () => {
    // The regex requires [2-9] after 233.
    expect(isValidGhanaPhone("233141234567")).toBe(false);
    expect(isValidGhanaPhone("233041234567")).toBe(false);
  });

  it("rejects empty input", () => {
    expect(isValidGhanaPhone("")).toBe(false);
  });
});

describe("sendSms — provider failover", () => {
  const ORIGINAL_ENV = { ...process.env };
  const ORIGINAL_FETCH = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    // Don't use vi.stubGlobal here — unstubAllGlobals in teardown would
    // also wipe useRuntimeConfig that setup.ts installs.
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
    process.env.SMS_PROVIDER = "hubtel";
    process.env.HUBTEL_CLIENT_ID = "test-id";
    process.env.HUBTEL_CLIENT_SECRET = "test-secret";
    process.env.HUBTEL_SENDER_ID = "ADLA";
    process.env.ARKESEL_API_KEY = "test-key";
    process.env.ARKESEL_SENDER_ID = "ADLA";
  });

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
    // Restore env exactly: process.env behaves like a record we can rebuild.
    for (const k of Object.keys(process.env)) {
      if (!(k in ORIGINAL_ENV)) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete process.env[k];
      }
    }
    Object.assign(process.env, ORIGINAL_ENV);
  });

  function mockResponse(status: number, body: unknown) {
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    });
  }

  it("returns success without calling the fallback when primary succeeds", async () => {
    fetchMock.mockReturnValueOnce(mockResponse(200, { MessageId: "msg-1" }));

    const result = await sendSms("0241234567", "hi");

    expect(result.success).toBe(true);
    expect(result.provider).toBe("hubtel");
    expect(result.messageId).toBe("msg-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toContain("hubtel");
  });

  it("falls back to Arkesel when Hubtel returns a non-200", async () => {
    fetchMock
      .mockReturnValueOnce(mockResponse(503, { Message: "service unavailable" }))
      .mockReturnValueOnce(mockResponse(200, { status: "success", data: [{ id: "ark-1" }] }));

    const result = await sendSms("0241234567", "hi");

    expect(result.success).toBe(true);
    expect(result.provider).toBe("arkesel");
    expect(result.messageId).toBe("ark-1");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]![0]).toContain("arkesel");
  });

  it("reports failure when both providers fail", async () => {
    fetchMock
      .mockReturnValueOnce(mockResponse(503, { Message: "hubtel down" }))
      .mockReturnValueOnce(mockResponse(503, { status: "error", message: "arkesel down" }));

    const result = await sendSms("0241234567", "hi");

    expect(result.success).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not try the fallback when the other provider has no credentials", async () => {
    delete process.env.ARKESEL_API_KEY;
    fetchMock.mockReturnValueOnce(mockResponse(503, { Message: "hubtel down" }));

    const result = await sendSms("0241234567", "hi");

    expect(result.success).toBe(false);
    // Should not have hit the dev-mode-mock arkesel and reported a fake success.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses Arkesel first when configured as primary", async () => {
    process.env.SMS_PROVIDER = "arkesel";
    fetchMock.mockReturnValueOnce(mockResponse(200, { status: "success", data: [{ id: "ark-2" }] }));

    const result = await sendSms("0241234567", "hi");

    expect(result.success).toBe(true);
    expect(result.provider).toBe("arkesel");
    expect(fetchMock.mock.calls[0]![0]).toContain("arkesel");
  });
});

