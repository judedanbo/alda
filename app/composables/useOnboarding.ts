import type { OnboardingItem } from "~/help";
import { onboardingChecklists } from "~/help";
import type { ItemContext, OnboardingState } from "~/help/onboarding-eval";
import { computeProgress, isItemComplete } from "~/help/onboarding-eval";
import {
  isOnboardingDismissed,
  isOnboardingItemDone,
  isTourCompleted,
  setOnboardingDismissed,
  setOnboardingItemDone,
} from "~/help/storage";
import { useAuthStore } from "~/stores/auth";

export interface OnboardingItemView {
  item: OnboardingItem;
  done: boolean;
}

/**
 * Drives the per-role onboarding checklist. Storage-backed values are mirrored
 * into refs (read in onMounted) so the component stays reactive and SSR-safe.
 */
export function useOnboarding() {
  const authStore = useAuthStore();
  const { currentRole } = useHelp();
  const { start, running } = useTour();
  const { hasActiveDeclaration, check } = useActiveDeclaration();

  const checklist = computed(() => onboardingChecklists[currentRole.value]);

  const manualDone = ref<Record<string, boolean>>({});
  const tourDone = ref<Record<string, boolean>>({});
  const dismissed = ref(false);

  function refreshStorage() {
    const role = currentRole.value;
    const m: Record<string, boolean> = {};
    const t: Record<string, boolean> = {};
    for (const item of checklist.value.items) {
      m[item.id] = isOnboardingItemDone(role, item.id);
      if (item.actionTourId) {
        t[item.actionTourId] = isTourCompleted(item.actionTourId);
      }
    }
    manualDone.value = m;
    tourDone.value = t;
    dismissed.value = isOnboardingDismissed(role);
  }

  const ctx = computed<ItemContext>(() => {
    const state: OnboardingState = {
      emailVerified: authStore.isEmailVerified,
      profileCreated: !!authStore.user?.hasProfile,
      profileVerified: authStore.isVerified,
      hasActiveDeclaration: hasActiveDeclaration.value,
    };
    return {
      state,
      isTourCompleted: (id) => tourDone.value[id] ?? false,
      isManuallyDone: (id) => manualDone.value[id] ?? false,
    };
  });

  const items = computed<OnboardingItemView[]>(() =>
    checklist.value.items.map((item) => ({
      item,
      done: isItemComplete(item, ctx.value),
    })),
  );

  const progress = computed(() => computeProgress(checklist.value.items, ctx.value));

  // A tour finishing (running true -> false) may complete an action item.
  watch(running, (now, was) => {
    if (was && !now) refreshStorage();
  });
  watch(currentRole, refreshStorage);

  onMounted(() => {
    refreshStorage();
    check();
  });

  function dismiss() {
    setOnboardingDismissed(currentRole.value, true);
    dismissed.value = true;
  }

  function setManual(itemId: string, done: boolean) {
    setOnboardingItemDone(currentRole.value, itemId, done);
    refreshStorage();
  }

  function runAction(item: OnboardingItem) {
    if (item.actionTourId) {
      start(item.actionTourId);
      return;
    }
    if (item.actionTo) {
      // "action" items complete on navigation; "auto" items track a live signal.
      if (item.completion !== "auto") {
        setOnboardingItemDone(currentRole.value, item.id, true);
        refreshStorage();
      }
      navigateTo(item.actionTo);
    }
  }

  return {
    checklist,
    items,
    progress,
    dismissed,
    dismiss,
    setManual,
    runAction,
  };
}
