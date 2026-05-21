import type { KvStorage } from "../server/utils/analytics-storage";

/** In-memory KvStorage double — clones values on write like a real KV store. */
export function makeFakeStorage(): KvStorage & { size: () => number } {
  const map = new Map<string, unknown>();
  return {
    async getItem<T>(key: string): Promise<T | null> {
      return map.has(key) ? (structuredClone(map.get(key)) as T) : null;
    },
    async setItem(key: string, value: unknown): Promise<void> {
      map.set(key, structuredClone(value));
    },
    async removeItem(key: string): Promise<void> {
      map.delete(key);
    },
    async getKeys(): Promise<string[]> {
      return [...map.keys()];
    },
    size: () => map.size,
  };
}

/** Minimal H3-event double exposing just `node.res.setHeader`. */
export function makeFakeEvent(): { node: { res: { setHeader: () => void } } } {
  return { node: { res: { setHeader: () => {} } } };
}
