import jwt, { type SignOptions, type VerifyOptions } from "jsonwebtoken";
import type { H3Event } from "h3";

export interface JwtPayload {
  userId: string;
  email: string;
  roles: string[];
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// L-2: tag every token we mint with audience + issuer claims, and require
// the matching claims on verification. If the JWT_SECRET is ever shared
// with a sibling service (or stolen and reused against this one), tokens
// minted elsewhere fail with `JsonWebTokenError: jwt audience invalid`
// instead of silently authenticating.
const JWT_ISSUER = "adla-auth";
const JWT_AUDIENCE = "adla";

const VERIFY_OPTIONS: VerifyOptions = {
  audience: JWT_AUDIENCE,
  issuer: JWT_ISSUER,
};

/**
 * Generate an access token
 */
export function generateAccessToken(payload: JwtPayload): string {
  const config = useRuntimeConfig();
  const options: SignOptions = {
    expiresIn: (config.jwtExpiresIn || "15m") as SignOptions["expiresIn"],
    audience: JWT_AUDIENCE,
    issuer: JWT_ISSUER,
  };
  return jwt.sign(payload, config.jwtSecret, options);
}

/**
 * Generate a refresh token
 */
export function generateRefreshToken(payload: JwtPayload): string {
  const config = useRuntimeConfig();
  const options: SignOptions = {
    expiresIn: (config.jwtRefreshExpiresIn || "7d") as SignOptions["expiresIn"],
    audience: JWT_AUDIENCE,
    issuer: JWT_ISSUER,
  };
  return jwt.sign(payload, config.jwtRefreshSecret, options);
}

/**
 * Generate both access and refresh tokens
 */
export function generateTokenPair(payload: JwtPayload): TokenPair {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
}

/**
 * Verify an access token
 */
export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    const config = useRuntimeConfig();
    return jwt.verify(token, config.jwtSecret, VERIFY_OPTIONS) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Verify a refresh token
 */
export function verifyRefreshToken(token: string): JwtPayload | null {
  try {
    const config = useRuntimeConfig();
    return jwt.verify(token, config.jwtRefreshSecret, VERIFY_OPTIONS) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(event: H3Event): string | null {
  const authHeader = getHeader(event, "authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * Get the current authenticated user from the request
 */
export function getAuthUser(event: H3Event): JwtPayload | null {
  const token = extractTokenFromHeader(event);
  if (!token) {
    return null;
  }
  return verifyAccessToken(token);
}

/**
 * Calculate token expiry date
 */
export function getTokenExpiry(duration: string): Date {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match || !match[1] || !match[2]) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const now = new Date();
  switch (unit) {
    case "s":
      now.setSeconds(now.getSeconds() + value);
      break;
    case "m":
      now.setMinutes(now.getMinutes() + value);
      break;
    case "h":
      now.setHours(now.getHours() + value);
      break;
    case "d":
      now.setDate(now.getDate() + value);
      break;
  }

  return now;
}
