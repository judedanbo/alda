import crypto from "node:crypto";
import redis from "./redis";

export function buildCacheKey(prefix: string, params: Record<string, unknown>): string {
  const sorted = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .sort(([a], [b]) => a.localeCompare(b));
  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify(sorted))
    .digest("hex")
    .slice(0, 12);
  return `analytics:decl:${prefix}:${hash}`;
}

export async function getCached<T>(
  key: string,
  ttlSeconds: number,
  computeFn: () => Promise<T>,
): Promise<T> {
  try {
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch {
    // Redis unavailable — fall through to compute
  }

  const result = await computeFn();

  try {
    await redis.set(key, JSON.stringify(result), "EX", ttlSeconds);
  } catch {
    // Redis unavailable — result still returned
  }

  return result;
}
