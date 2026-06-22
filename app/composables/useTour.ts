import type { TourStep } from "~/help";
import { getTourById } from "~/help";
import {
  isTourCompleted,
  markTourCompleted,
  resetTour,
} from "~/help/storage";

interface DriverPopoverStep {
  element?: string;
  popover: {
    title: string;
    description: string;
    side?: TourStep["side"];
    align?: TourStep["align"];
  };
}

function toDriverStep(step: TourStep): DriverPopoverStep {
  return {
    ...(step.element ? { element: step.element } : {}),
    popover: {
      title: step.title,
      description: step.description,
      ...(step.side ? { side: step.side } : {}),
      ...(step.align ? { align: step.align } : {}),
    },
  };
}

/**
 * Launches interactive tours via driver.js. The library is dynamically
 * imported so it never bloats the initial bundle.
 */
export function useTour() {
  const router = useRouter();
  const route = useRoute();
  const running = ref(false);

  async function start(tourId: string): Promise<void> {
    if (!import.meta.client) return;

    const def = getTourById(tourId);
    if (!def) return;

    // Navigate to the tour's expected route so its target elements exist.
    if (def.route && route.path !== def.route) {
      await router.push(def.route);
    }
    await nextTick();

    // Skip steps whose target is missing or not visible (graceful degradation
    // — e.g. desktop-only nav links on a mobile viewport).
    const steps = def.steps
      .filter((s) => {
        if (!s.element) return true;
        const el = document.querySelector(s.element);
        return !!el && el.getClientRects().length > 0;
      })
      .map(toDriverStep);
    if (steps.length === 0) return;

    const { driver } = await import("driver.js");

    running.value = true;
    const instance = driver({
      showProgress: true,
      allowClose: true,
      nextBtnText: "Next",
      prevBtnText: "Back",
      doneBtnText: "Done",
      // Scopes the branded popover theme in assets/css/main.css so our
      // overrides never leak into any other driver.js usage.
      popoverClass: "adla-tour",
      steps,
      onDestroyed: () => {
        running.value = false;
        markTourCompleted(tourId);
      },
    });
    instance.drive();
  }

  return {
    start,
    running,
    isCompleted: (id: string) => isTourCompleted(id),
    reset: (id: string) => resetTour(id),
  };
}
