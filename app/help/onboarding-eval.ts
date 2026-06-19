// Pure onboarding-completion logic, kept separate from the Vue composable so it
// can be unit-tested with plain objects.

import type { OnboardingItem, OnboardingSignal } from "./types";

export interface OnboardingState {
  emailVerified: boolean;
  phoneVerified: boolean;
  profileCreated: boolean;
  profileVerified: boolean;
  hasActiveDeclaration: boolean;
}

export interface ItemContext {
  state: OnboardingState;
  isTourCompleted: (tourId: string) => boolean;
  isManuallyDone: (itemId: string) => boolean;
}

export function evaluateSignal(
  signal: OnboardingSignal,
  state: OnboardingState,
): boolean {
  switch (signal) {
    case "emailVerified":
      return state.emailVerified;
    case "phoneVerified":
      return state.phoneVerified;
    case "profileCreated":
      return state.profileCreated;
    case "profileVerified":
      return state.profileVerified;
    case "hasActiveDeclaration":
      return state.hasActiveDeclaration;
    default:
      return false;
  }
}

/** Whether a single checklist item counts as complete in the given context. */
export function isItemComplete(item: OnboardingItem, ctx: ItemContext): boolean {
  if (item.completion === "auto") {
    return item.completionKey
      ? evaluateSignal(item.completionKey, ctx.state)
      : false;
  }
  if (item.completion === "action" && item.actionTourId) {
    return (
      ctx.isTourCompleted(item.actionTourId) || ctx.isManuallyDone(item.id)
    );
  }
  // "manual" items, and "action" items that only navigate.
  return ctx.isManuallyDone(item.id);
}

export interface OnboardingProgress {
  done: number;
  total: number;
  allComplete: boolean;
}

export function computeProgress(
  items: OnboardingItem[],
  ctx: ItemContext,
): OnboardingProgress {
  const done = items.filter((i) => isItemComplete(i, ctx)).length;
  return { done, total: items.length, allComplete: items.length > 0 && done === items.length };
}
