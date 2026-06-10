/**
 * JWT algorithm pinning (server/utils/jwt.ts).
 *
 * Sign and verify are locked to HS256. Tokens carrying any other `alg` —
 * including the classic `alg: "none"` bypass — must be rejected even when
 * everything else about them (payload, audience, issuer, signature scheme)
 * lines up.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  type JwtPayload,
} from "../server/utils/jwt";

const TEST_CONFIG = {
  jwtSecret: "unit-test-access-secret",
  jwtRefreshSecret: "unit-test-refresh-secret",
  jwtExpiresIn: "15m",
  jwtRefreshExpiresIn: "7d",
};

const payload: JwtPayload = {
  userId: "user-1",
  email: "user@example.com",
  roles: ["applicant"],
};

const CLAIMS = { audience: "adla", issuer: "adla-auth" };

describe("jwt algorithm pinning", () => {
  beforeEach(() => {
    vi.stubGlobal("useRuntimeConfig", () => TEST_CONFIG);
  });

  it("round-trips a token minted by generateAccessToken", () => {
    const token = generateAccessToken(payload);
    const verified = verifyAccessToken(token);
    expect(verified?.userId).toBe(payload.userId);
    expect(jwt.decode(token, { complete: true })?.header.alg).toBe("HS256");
  });

  it("round-trips a refresh token", () => {
    const token = generateRefreshToken(payload);
    expect(verifyRefreshToken(token)?.userId).toBe(payload.userId);
  });

  it("rejects an unsigned alg:none token with matching claims", () => {
    // jsonwebtoken refuses to *mint* alg:none with a secret, so build the
    // token by hand: base64url(header).base64url(payload). with empty sig.
    const b64 = (obj: object) =>
      Buffer.from(JSON.stringify(obj)).toString("base64url");
    const noneToken = `${b64({ alg: "none", typ: "JWT" })}.${b64({
      ...payload,
      aud: "adla",
      iss: "adla-auth",
      exp: Math.floor(Date.now() / 1000) + 900,
    })}.`;
    expect(verifyAccessToken(noneToken)).toBeNull();
    expect(verifyRefreshToken(noneToken)).toBeNull();
  });

  it("rejects a token signed with a non-pinned HMAC algorithm", () => {
    const hs512 = jwt.sign(payload, TEST_CONFIG.jwtSecret, {
      algorithm: "HS512",
      expiresIn: "15m",
      ...CLAIMS,
    });
    expect(verifyAccessToken(hs512)).toBeNull();
  });

  it("rejects an access token presented as a refresh token (separate secrets)", () => {
    const access = generateAccessToken(payload);
    expect(verifyRefreshToken(access)).toBeNull();
  });

  it("rejects tokens missing the pinned audience/issuer claims", () => {
    const bare = jwt.sign(payload, TEST_CONFIG.jwtSecret, {
      algorithm: "HS256",
      expiresIn: "15m",
    });
    expect(verifyAccessToken(bare)).toBeNull();
  });
});
