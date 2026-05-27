/**
 * Per-account login-failure tracking + cool-down lockout.
 *
 * Backed by the existing analytics storage (Redis when configured, in-memory
 * otherwise — same store the rate limiter uses). Two keys per user:
 *
 *   account-fails:<userId>  — failure counter, 15-minute TTL window.
 *   account-lock:<userId>   — opaque lock marker, 60-minute TTL.
 *
 * `recordLoginFailure` increments the counter. When it crosses the
 * threshold, it sets the lock and the gate at the top of `login.post.ts`
 * starts refusing the account until the lock TTL expires. `clearLoginFailures`
 * runs on every successful login so a long-lived legitimate user never
 * accumulates state.
 *
 * The lock is per-account, not per-IP. Combined with the per-IP rate limit
 * (which uses the same storage layer), distributed credential-stuffing
 * against a single account is bounded even if the attacker rotates IPs.
 */

import { getAnalyticsStorage, safeGet } from "./analytics-storage";

const FAIL_WINDOW_SECONDS = 15 * 60;
const LOCK_TTL_SECONDS = 60 * 60;
const FAIL_THRESHOLD = 10;

function failsKey(userId: string): string {
  return `account-fails:${userId}`;
}

function lockKey(userId: string): string {
  return `account-lock:${userId}`;
}

export interface LockoutState {
  locked: boolean;
  /** ISO timestamp the lock expires; only set when `locked === true`. */
  unlockAt?: string;
}

/** Check whether the account is currently locked. Read-only. */
export async function isAccountLocked(userId: string): Promise<LockoutState> {
  const storage = getAnalyticsStorage();
  const lock = await safeGet<{ until: string }>(storage, lockKey(userId));
  if (lock?.until) {
    // Lock entries carry the unlock timestamp; if it's already in the past
    // (shouldn't happen given the TTL, but storage clocks can drift), treat
    // it as cleared.
    if (Date.parse(lock.until) > Date.now()) {
      return { locked: true, unlockAt: lock.until };
    }
  }
  return { locked: false };
}

/**
 * Record a login failure. Increments the failure counter; when the
 * threshold is crossed, sets a lock that survives the failure-counter
 * window. Returns the resulting state so the caller can surface the
 * unlock time in the response.
 */
export async function recordLoginFailure(userId: string): Promise<LockoutState> {
  const storage = getAnalyticsStorage();
  const counter = await safeGet<{ count: number }>(storage, failsKey(userId));
  const nextCount = (counter?.count ?? 0) + 1;
  try {
    await storage.setItem(
      failsKey(userId),
      { count: nextCount },
      { ttl: FAIL_WINDOW_SECONDS },
    );
  } catch {
    // Storage write failed; the per-IP limiter and the local rate-limit
    // fallback still apply. Don't fail the request.
  }

  if (nextCount >= FAIL_THRESHOLD) {
    const unlockAt = new Date(Date.now() + LOCK_TTL_SECONDS * 1000).toISOString();
    try {
      await storage.setItem(
        lockKey(userId),
        { until: unlockAt },
        { ttl: LOCK_TTL_SECONDS },
      );
    } catch {
      // See above.
    }
    return { locked: true, unlockAt };
  }
  return { locked: false };
}

/** Clear both the failure counter and the lock — call on successful login. */
export async function clearLoginFailures(userId: string): Promise<void> {
  const storage = getAnalyticsStorage();
  try {
    await storage.removeItem(failsKey(userId));
  } catch {
    /* tolerate */
  }
  try {
    await storage.removeItem(lockKey(userId));
  } catch {
    /* tolerate */
  }
}

/** Test-only constants exported for assertions. */
export const _LOCKOUT_CONSTANTS_FOR_TESTS = {
  FAIL_WINDOW_SECONDS,
  LOCK_TTL_SECONDS,
  FAIL_THRESHOLD,
};
