<script setup lang="ts">
import { computed } from "vue";
import { Toast } from ".";
import { useToastStore } from "~/stores/toast";

const store = useToastStore();

// On mobile the region is a full-width strip pinned to the bottom; from `sm`
// up it follows the configured position (default bottom-right).
const positionClass = computed(() => {
  switch (store.position) {
    case "bottom-left":
      return "sm:inset-x-auto sm:left-0 sm:bottom-0 sm:items-start";
    case "bottom-center":
      return "sm:inset-x-0 sm:bottom-0 sm:items-center";
    case "top-right":
      return "sm:inset-x-auto sm:right-0 sm:top-0 sm:bottom-auto sm:items-end";
    case "top-left":
      return "sm:inset-x-auto sm:left-0 sm:top-0 sm:bottom-auto sm:items-start";
    case "top-center":
      return "sm:inset-x-0 sm:top-0 sm:bottom-auto sm:items-center";
    case "bottom-right":
    default:
      return "sm:inset-x-auto sm:right-0 sm:bottom-0 sm:items-end";
  }
});

// Toasts nearest the anchored edge should be newest. For top positions we
// render in natural (newest-first) order; for bottom positions we flip so the
// newest sits at the bottom, closest to the corner.
const isTop = computed(() => store.position.startsWith("top"));
const ordered = computed(() =>
  isTop.value ? store.toasts : [...store.toasts].slice().reverse(),
);
</script>

<template>
  <Teleport to="body">
    <div
      class="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex w-full flex-col gap-2 p-4 sm:max-w-sm"
      :class="positionClass"
      role="region"
      aria-label="Notifications"
    >
      <TransitionGroup name="toast" tag="div" class="flex flex-col gap-2">
        <Toast
          v-for="t in ordered"
          :key="t.id"
          :toast="t"
          @dismiss="store.dismiss"
          @pause="store.pause"
          @resume="store.resume"
        />
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
/* Leave animation for removed toasts. tw-animate-css drives the enter; this
   handles the exit + the reflow of remaining toasts. Collapses to instant
   under html.a11y-reduce-motion via the global rule in main.css. */
.toast-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
.toast-move {
  transition: transform 0.2s ease;
}
</style>
