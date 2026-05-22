// Client-only localStorage wrapper for help-system state (tour completion,
// onboarding progress, onboarding dismissal).
//
// Every function accepts an optional storage argument so the logic can be
// unit-tested with a fake. When omitted, the real browser localStorage is used;
// on the server (SSR) or when localStorage is unavailable, reads return safe
// defaults and writes are no-ops.

import type { HelpRole } from "./types";

export interface SimpleStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const PREFIX = "adla:help:";

function resolveStorage(): SimpleStorage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function read(key: string, storage?: SimpleStorage | null): string | null {
  const s = storage ?? resolveStorage();
  if (!s) return null;
  try {
    return s.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

function write(key: string, value: string, storage?: SimpleStorage | null): void {
  const s = storage ?? resolveStorage();
  if (!s) return;
  try {
    s.setItem(PREFIX + key, value);
  } catch {
    /* quota / disabled storage — ignore */
  }
}

function remove(key: string, storage?: SimpleStorage | null): void {
  const s = storage ?? resolveStorage();
  if (!s) return;
  try {
    s.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

// --- Tours -----------------------------------------------------------------

export function isTourCompleted(tourId: string, storage?: SimpleStorage | null): boolean {
  return read(`tour:${tourId}`, storage) === "completed";
}

export function markTourCompleted(tourId: string, storage?: SimpleStorage | null): void {
  write(`tour:${tourId}`, "completed", storage);
}

export function resetTour(tourId: string, storage?: SimpleStorage | null): void {
  remove(`tour:${tourId}`, storage);
}

// --- Onboarding ------------------------------------------------------------

export function isOnboardingItemDone(
  role: HelpRole,
  itemId: string,
  storage?: SimpleStorage | null,
): boolean {
  return read(`onboarding:${role}:item:${itemId}`, storage) === "done";
}

export function setOnboardingItemDone(
  role: HelpRole,
  itemId: string,
  done: boolean,
  storage?: SimpleStorage | null,
): void {
  if (done) write(`onboarding:${role}:item:${itemId}`, "done", storage);
  else remove(`onboarding:${role}:item:${itemId}`, storage);
}

export function isOnboardingDismissed(
  role: HelpRole,
  storage?: SimpleStorage | null,
): boolean {
  return read(`onboarding:${role}:dismissed`, storage) === "true";
}

export function setOnboardingDismissed(
  role: HelpRole,
  dismissed: boolean,
  storage?: SimpleStorage | null,
): void {
  if (dismissed) write(`onboarding:${role}:dismissed`, "true", storage);
  else remove(`onboarding:${role}:dismissed`, storage);
}
