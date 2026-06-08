/**
 * Tests for the admin SMTP health-probe endpoint.
 *
 * The probe never sends mail; it classifies the outcome of
 * verifyEmailConnection() into an actionable response. These tests lock that
 * classification — and the guarantee that credentials never leak into the
 * response body — so a future refactor can't silently break the hints.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  userRole: { findMany: vi.fn() },
}));
const verifyEmailConnectionMock = vi.hoisted(() => vi.fn());
const isSmtpAuthConfiguredMock = vi.hoisted(() => vi.fn());
const getResolvedEmailConfigMock = vi.hoisted(() =>
  vi.fn(() => Promise.resolve({ host: "smtp.example.com", port: 587, user: "", pass: "", from: "" })),
);

vi.mock("~/server/utils/prisma", () => ({ default: prismaMock }));
vi.mock("~/server/services/email.service", () => ({
  verifyEmailConnection: verifyEmailConnectionMock,
  isSmtpAuthConfigured: isSmtpAuthConfiguredMock,
}));
// The endpoint resolves host/port via the credential resolver (DB→env).
vi.mock("~/server/utils/notification-config", () => ({
  getResolvedEmailConfig: getResolvedEmailConfigMock,
}));

// The endpoint reads host/port from runtimeConfig for the response. Override
// the analytics-shaped stub from test/setup.ts with the SMTP shape we need.
vi.stubGlobal("useRuntimeConfig", () => ({ smtpHost: "smtp.example.com", smtpPort: 587 }));

const handler = (await import("~/server/api/admin/smtp-check.get")).default;

/** nodemailer-style error: an Error carrying a `.code` (and optional SMTP status). */
function smtpError(code: string, responseCode?: number) {
  return Object.assign(new Error(`simulated ${code}`), { code, responseCode });
}

// Pass `null` for an unauthenticated event. (Can't use `undefined` as the
// no-auth sentinel — an explicit `undefined` arg triggers the default value.)
function fakeEvent(authUserId: string | null = "admin-1") {
  return {
    path: "/api/admin/smtp-check",
    node: { req: { headers: {}, url: "/api/admin/smtp-check" } },
    context: authUserId
      ? { auth: { userId: authUserId, email: "admin@example.com", roles: ["admin"] } }
      : {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: caller is an admin and creds are present. Individual tests narrow.
  prismaMock.userRole.findMany.mockResolvedValue([{ role: { name: "admin" } }]);
  isSmtpAuthConfiguredMock.mockReturnValue(true);
  verifyEmailConnectionMock.mockResolvedValue(true);
  // The error branch logs the full error server-side; keep test output clean.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/admin/smtp-check — access control", () => {
  it("rejects unauthenticated callers with 401", async () => {
    await expect(handler(fakeEvent(null))).rejects.toMatchObject({ statusCode: 401 });
    expect(verifyEmailConnectionMock).not.toHaveBeenCalled();
  });

  it("rejects non-admin callers with 403", async () => {
    prismaMock.userRole.findMany.mockResolvedValue([{ role: { name: "schedule_officer" } }]);

    await expect(handler(fakeEvent("officer-1"))).rejects.toMatchObject({ statusCode: 403 });
    expect(verifyEmailConnectionMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/smtp-check — probe outcomes", () => {
  it("short-circuits with a NUXT_-prefix hint when credentials are unconfigured", async () => {
    isSmtpAuthConfiguredMock.mockReturnValue(false);

    const result = await handler(fakeEvent());

    expect(result).toMatchObject({ ok: false, authConfigured: false });
    expect(result.hint).toMatch(/NUXT_SMTP_USER/);
    // No point attempting a connection when creds are empty.
    expect(verifyEmailConnectionMock).not.toHaveBeenCalled();
  });

  it("returns ok:true with connection target on a successful verify", async () => {
    const result = await handler(fakeEvent());

    expect(result).toEqual({
      ok: true,
      authConfigured: true,
      host: "smtp.example.com",
      port: 587,
    });
    expect(verifyEmailConnectionMock).toHaveBeenCalledTimes(1);
  });

  it("classifies EAUTH as an authentication failure", async () => {
    verifyEmailConnectionMock.mockRejectedValue(smtpError("EAUTH", 535));

    const result = await handler(fakeEvent());

    expect(result).toMatchObject({ ok: false, authConfigured: true, code: "EAUTH", responseCode: 535 });
    expect(result.hint).toMatch(/[Aa]uthentication/);
  });

  it("classifies ECONNECTION as a connection problem and names host:port", async () => {
    verifyEmailConnectionMock.mockRejectedValue(smtpError("ECONNECTION"));

    const result = await handler(fakeEvent());

    expect(result).toMatchObject({ ok: false, code: "ECONNECTION" });
    expect(result.hint).toContain("smtp.example.com:587");
  });

  it("classifies ETIMEDOUT as a firewall/egress timeout", async () => {
    verifyEmailConnectionMock.mockRejectedValue(smtpError("ETIMEDOUT"));

    const result = await handler(fakeEvent());

    expect(result).toMatchObject({ ok: false, code: "ETIMEDOUT" });
    expect(result.hint).toMatch(/timed out|firewall/i);
  });

  it("falls back to a generic hint for an unrecognized error code", async () => {
    verifyEmailConnectionMock.mockRejectedValue(smtpError("ESOMETHINGELSE"));

    const result = await handler(fakeEvent());

    expect(result).toMatchObject({ ok: false, code: "ESOMETHINGELSE" });
    expect(result.hint).toMatch(/server logs/i);
  });

  it("never leaks credentials in any response branch", async () => {
    // Success, unconfigured, and error responses must all be free of secrets.
    isSmtpAuthConfiguredMock.mockReturnValue(false);
    const unconfigured = JSON.stringify(await handler(fakeEvent()));

    isSmtpAuthConfiguredMock.mockReturnValue(true);
    const ok = JSON.stringify(await handler(fakeEvent()));

    verifyEmailConnectionMock.mockRejectedValue(smtpError("EAUTH"));
    const failed = JSON.stringify(await handler(fakeEvent()));

    for (const body of [unconfigured, ok, failed]) {
      expect(body).not.toMatch(/smtpPass|smtpUser|password/i);
    }
  });
});
