/**
 * Audit: which /api/auth/* routes are reachable by an ALREADY-authenticated
 * caller (one presenting a valid Bearer access token)?
 *
 * The server middleware (server/middleware/auth.ts) allow-lists every route
 * below, so it never rejects an authenticated caller on its own — the only
 * thing that blocks one is an in-handler guard. login/register added that
 * guard (reject with 403); the password-recovery / verification / refresh
 * routes intentionally did not. This test pins that contract so it can't
 * regress silently.
 *
 * All guards run before readBody/getQuery/prisma, so no DB is needed: a
 * guarded route throws 403 before validation; an unguarded route falls
 * through to its own 400 (missing body/token) — never 403.
 */
import { describe, expect, it, vi } from "vitest";
import { TEST_ANALYTICS_CONFIG } from "./setup";

// Give the JWT utils a real secret so we can mint/verify a token. (The shared
// setup stubs useRuntimeConfig with analytics only — override it here.)
const JWT_SECRET = "audit-test-secret";
vi.stubGlobal("useRuntimeConfig", () => ({
  jwtSecret: JWT_SECRET,
  jwtRefreshSecret: JWT_SECRET,
  jwtExpiresIn: "15m",
  jwtRefreshExpiresIn: "7d",
  analytics: TEST_ANALYTICS_CONFIG,
}));

// A request body/query are read only AFTER the auth guard, so for the
// unguarded routes these empty stubs make them fail fast at their own
// validation (400) rather than touching the database.
vi.stubGlobal("readBody", vi.fn(async () => ({})));
vi.stubGlobal("getQuery", vi.fn(() => ({})));

// The prisma singleton must never be reached in any of these cases.
vi.mock("~/server/utils/prisma", () => ({
  default: new Proxy(
    {},
    { get() { throw new Error("prisma should not be reached in this test"); } },
  ),
}));

const { generateAccessToken } = await import("~/server/utils/jwt");

const TOKEN = generateAccessToken({
  userId: "u-1",
  email: "someone@example.com",
  roles: ["applicant"],
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function authedEvent(): any {
  return { node: { req: { headers: { authorization: `Bearer ${TOKEN}` } } }, context: {} };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function anonEvent(): any {
  return { node: { req: { headers: {} } }, context: {} };
}

const login = (await import("~/server/api/auth/login.post")).default;
const register = (await import("~/server/api/auth/register.post")).default;
const forgotPassword = (await import("~/server/api/auth/forgot-password.post")).default;
const resetPassword = (await import("~/server/api/auth/reset-password.post")).default;
const verifyEmail = (await import("~/server/api/auth/verify-email.get")).default;
const refresh = (await import("~/server/api/auth/refresh.post")).default;

describe("auth routes — already-authenticated access", () => {
  describe("BLOCKED for authenticated callers (in-handler 403 guard)", () => {
    it("POST /api/auth/login rejects a valid Bearer token with 403", async () => {
      await expect(login(authedEvent())).rejects.toMatchObject({ statusCode: 403 });
    });

    it("POST /api/auth/register rejects a valid Bearer token with 403", async () => {
      await expect(register(authedEvent())).rejects.toMatchObject({ statusCode: 403 });
    });

    it("login still works for anonymous callers (no 403 — falls through to validation)", async () => {
      // No token → guard passes → reaches body validation → 400, never 403.
      await expect(login(anonEvent())).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe("ACCESSIBLE to authenticated callers (no in-handler guard)", () => {
    it("POST /api/auth/forgot-password is not blocked (400 validation, not 403)", async () => {
      await expect(forgotPassword(authedEvent())).rejects.toMatchObject({ statusCode: 400 });
    });

    it("POST /api/auth/reset-password is not blocked (400 validation, not 403)", async () => {
      await expect(resetPassword(authedEvent())).rejects.toMatchObject({ statusCode: 400 });
    });

    it("GET /api/auth/verify-email is not blocked (400 missing-token, not 403)", async () => {
      await expect(verifyEmail(authedEvent())).rejects.toMatchObject({ statusCode: 400 });
    });

    it("POST /api/auth/refresh is not blocked (400 missing-token, not 403)", async () => {
      await expect(refresh(authedEvent())).rejects.toMatchObject({ statusCode: 400 });
    });
  });
});
