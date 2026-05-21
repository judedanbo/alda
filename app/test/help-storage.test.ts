import { describe, it, expect, beforeEach } from "vitest";
import type { SimpleStorage } from "~/help/storage";
import {
  isTourCompleted,
  markTourCompleted,
  resetTour,
  isOnboardingItemDone,
  setOnboardingItemDone,
  isOnboardingDismissed,
  setOnboardingDismissed,
} from "~/help/storage";

/** In-memory SimpleStorage double. */
function makeFakeLocalStorage(): SimpleStorage & { dump: () => Record<string, string> } {
  const map = new Map<string, string>();
  return {
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    dump: () => Object.fromEntries(map),
  };
}

let store: ReturnType<typeof makeFakeLocalStorage>;

beforeEach(() => {
  store = makeFakeLocalStorage();
});

describe("tour completion storage", () => {
  it("round-trips a completed tour", () => {
    expect(isTourCompleted("tour-x", store)).toBe(false);
    markTourCompleted("tour-x", store);
    expect(isTourCompleted("tour-x", store)).toBe(true);
  });

  it("resets a tour", () => {
    markTourCompleted("tour-x", store);
    resetTour("tour-x", store);
    expect(isTourCompleted("tour-x", store)).toBe(false);
  });

  it("namespaces keys under the help prefix", () => {
    markTourCompleted("tour-x", store);
    expect(Object.keys(store.dump())[0]).toMatch(/^adla:help:/);
  });
});

describe("onboarding item storage", () => {
  it("round-trips a manually completed item", () => {
    expect(isOnboardingItemDone("applicant", "step-1", store)).toBe(false);
    setOnboardingItemDone("applicant", "step-1", true, store);
    expect(isOnboardingItemDone("applicant", "step-1", store)).toBe(true);
    setOnboardingItemDone("applicant", "step-1", false, store);
    expect(isOnboardingItemDone("applicant", "step-1", store)).toBe(false);
  });

  it("keeps items separate per role", () => {
    setOnboardingItemDone("applicant", "step-1", true, store);
    expect(isOnboardingItemDone("admin", "step-1", store)).toBe(false);
  });
});

describe("onboarding dismissal storage", () => {
  it("round-trips the dismissed flag", () => {
    expect(isOnboardingDismissed("legal_unit", store)).toBe(false);
    setOnboardingDismissed("legal_unit", true, store);
    expect(isOnboardingDismissed("legal_unit", store)).toBe(true);
    setOnboardingDismissed("legal_unit", false, store);
    expect(isOnboardingDismissed("legal_unit", store)).toBe(false);
  });
});

describe("storage with no backing store", () => {
  it("reads safe defaults and ignores writes when storage is null", () => {
    expect(isTourCompleted("tour-x", null)).toBe(false);
    expect(() => markTourCompleted("tour-x", null)).not.toThrow();
    expect(isOnboardingDismissed("admin", null)).toBe(false);
  });
});
