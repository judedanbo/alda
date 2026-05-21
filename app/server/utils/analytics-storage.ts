/**
 * Thin, fail-open wrapper around the Nitro `analytics` storage mount.
 *
 * The mount is backed by redis when `REDIS_URL` is configured (counters stay
 * correct across instances) and by the in-memory driver otherwise (per-instance
 * only — see `nuxt.config.ts`). Every helper swallows storage errors so a
 * counter backend outage can never fail or slow a user request.
 */

/** Minimal key/value contract — satisfied by unstorage and by test fakes. */
export interface KvStorage {
  getItem<T = unknown>(key: string): Promise<T | null>;
  setItem(key: string, value: unknown, opts?: { ttl?: number }): Promise<void>;
  removeItem(key: string): Promise<void>;
  getKeys?(base?: string): Promise<string[]>;
}

/** Stable key prefixes so the namespace stays inspectable and collision-free. */
export const StorageKeys = {
  rateLimit: (key: string) => `rl:${key}`,
  abuseStats: (ip: string) => `abuse:ip:${ip}`,
  enforcement: (ip: string) => `enforce:ip:${ip}`,
  block: (actorType: string, value: string) => `block:${actorType}:${value}`,
  allow: (actorType: string, value: string) => `allow:${actorType}:${value}`,
  aiVerify: (ip: string) => `aiverify:${ip}`,
  aiRanges: (provider: string) => `airanges:${provider}`,
  meta: (name: string) => `meta:${name}`,
} as const;

/** Returns the live Nitro `analytics` storage instance. */
export function getAnalyticsStorage(): KvStorage {
  return useStorage("analytics") as unknown as KvStorage;
}

/** Read a value; returns `null` on miss or any storage error. */
export async function safeGet<T>(storage: KvStorage, key: string): Promise<T | null> {
  try {
    return (await storage.getItem<T>(key)) ?? null;
  } catch (error) {
    console.error(`[analytics-storage] get failed for ${key}:`, error);
    return null;
  }
}

/** Write a value with an optional TTL (seconds). Never throws. */
export async function safeSet(
  storage: KvStorage,
  key: string,
  value: unknown,
  ttlSeconds?: number,
): Promise<void> {
  try {
    await storage.setItem(key, value, ttlSeconds ? { ttl: ttlSeconds } : undefined);
  } catch (error) {
    console.error(`[analytics-storage] set failed for ${key}:`, error);
  }
}

/** Delete a value. Never throws. */
export async function safeRemove(storage: KvStorage, key: string): Promise<void> {
  try {
    await storage.removeItem(key);
  } catch (error) {
    console.error(`[analytics-storage] remove failed for ${key}:`, error);
  }
}
