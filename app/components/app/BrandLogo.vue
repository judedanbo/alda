<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    /** Logo mark size. */
    size?: "sm" | "md" | "lg";
    /** Render the "Asset Declaration Portal / Ghana Audit Service" wordmark. */
    showWordmark?: boolean;
    /** Extra classes for the wordmark title (e.g. light text on the green band). */
    wordmarkClass?: string;
    /** Extra classes for the wordmark subtitle. */
    subtitleClass?: string;
    /** Place the mark on a white circular chip so it stays legible on dark/green. */
    chip?: boolean;
    /** Wrap the mark in a link to the home page. */
    to?: string;
  }>(),
  {
    size: "md",
    showWordmark: false,
    wordmarkClass: "text-foreground",
    subtitleClass: "text-muted-foreground",
    chip: false,
    to: undefined,
  },
);

// Pixel size keeps the intrinsic <img> dimensions in sync with the rendered box,
// so the browser reserves space and avoids layout shift (no @nuxt/image here).
const markPx = computed(() => ({ sm: 40, md: 56, lg: 72 })[props.size]);

const titleClass = computed(
  () => ({ sm: "text-base", md: "text-lg", lg: "text-xl" })[props.size],
);
</script>

<template>
  <component
    :is="to ? resolveComponent('NuxtLink') : 'div'"
    :to="to"
    class="flex items-center gap-3"
  >
    <span
      :class="[
        'shrink-0 inline-flex items-center justify-center',
        chip ? 'rounded-full bg-white p-1 shadow-sm ring-1 ring-black/5' : '',
      ]"
    >
      <img
        src="/gas-logo.png"
        alt="Ghana Audit Service"
        :width="markPx"
        :height="markPx"
        :style="{ width: `${markPx}px`, height: `${markPx}px` }"
        class="object-contain"
        loading="eager"
        decoding="async"
      >
    </span>

    <span v-if="showWordmark" class="leading-tight">
      <span :class="['block font-semibold', titleClass, wordmarkClass]">
        Asset Declaration Portal
      </span>
      <span :class="['block text-sm', subtitleClass]">
        Ghana Audit Service
      </span>
    </span>
  </component>
</template>
