import { describe, it, expect } from "vitest";
import {
  evaluateSignal,
  isItemComplete,
  computeProgress,
} from "~/help/onboarding-eval";
import type { ItemContext, OnboardingState } from "~/help/onboarding-eval";
import { onboardingChecklists } from "~/help";

const allFalse: OnboardingState = {
  emailVerified: false,
  profileCreated: false,
  profileVerified: false,
  hasActiveDeclaration: false,
};
const allTrue: OnboardingState = {
  emailVerified: true,
  profileCreated: true,
  profileVerified: true,
  hasActiveDeclaration: true,
};

function makeCtx(
  state: OnboardingState,
  opts: { tours?: string[]; manual?: string[] } = {},
): ItemContext {
  return {
    state,
    isTourCompleted: (id) => (opts.tours ?? []).includes(id),
    isManuallyDone: (id) => (opts.manual ?? []).includes(id),
  };
}

describe("evaluateSignal", () => {
  it("maps each signal to the matching state flag", () => {
    expect(evaluateSignal("emailVerified", allTrue)).toBe(true);
    expect(evaluateSignal("emailVerified", allFalse)).toBe(false);
    expect(evaluateSignal("profileCreated", allTrue)).toBe(true);
    expect(evaluateSignal("profileVerified", allFalse)).toBe(false);
    expect(evaluateSignal("hasActiveDeclaration", allTrue)).toBe(true);
  });
});

describe("isItemComplete", () => {
  const applicant = onboardingChecklists.applicant.items;
  const verifyEmail = applicant.find((i) => i.id === "verify-email")!;
  const takeTour = applicant.find((i) => i.id === "take-tour")!;
  const officerManual = onboardingChecklists.schedule_officer.items.find(
    (i) => i.completion === "manual",
  )!;

  it("resolves auto items from the live signal", () => {
    expect(isItemComplete(verifyEmail, makeCtx(allFalse))).toBe(false);
    expect(isItemComplete(verifyEmail, makeCtx(allTrue))).toBe(true);
  });

  it("resolves tour action items from tour completion or a manual tick", () => {
    expect(isItemComplete(takeTour, makeCtx(allFalse))).toBe(false);
    expect(
      isItemComplete(
        takeTour,
        makeCtx(allFalse, { tours: [takeTour.actionTourId!] }),
      ),
    ).toBe(true);
    expect(
      isItemComplete(takeTour, makeCtx(allFalse, { manual: [takeTour.id] })),
    ).toBe(true);
  });

  it("resolves manual items from a manual tick", () => {
    expect(isItemComplete(officerManual, makeCtx(allFalse))).toBe(false);
    expect(
      isItemComplete(officerManual, makeCtx(allFalse, { manual: [officerManual.id] })),
    ).toBe(true);
  });
});

describe("computeProgress", () => {
  it("reports zero progress when nothing is done", () => {
    const items = onboardingChecklists.applicant.items;
    const progress = computeProgress(items, makeCtx(allFalse));
    expect(progress.done).toBe(0);
    expect(progress.total).toBe(items.length);
    expect(progress.allComplete).toBe(false);
  });

  it("reports full progress when every item is done", () => {
    const items = onboardingChecklists.applicant.items;
    const tours = items
      .map((i) => i.actionTourId)
      .filter((t): t is string => !!t);
    const manual = items.map((i) => i.id);
    const progress = computeProgress(
      items,
      makeCtx(allTrue, { tours, manual }),
    );
    expect(progress.done).toBe(items.length);
    expect(progress.allComplete).toBe(true);
  });
});
