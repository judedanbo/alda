<script setup lang="ts">
import { InfoIcon, TriangleAlertIcon, LightbulbIcon } from "lucide-vue-next";
import type { HelpNoteVariant } from "~/help";

defineProps<{ variant: HelpNoteVariant; text?: string }>();

const config: Record<
  HelpNoteVariant,
  { icon: typeof InfoIcon; class: string }
> = {
  info: {
    icon: InfoIcon,
    class:
      "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100",
  },
  warning: {
    icon: TriangleAlertIcon,
    class:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
  },
  tip: {
    icon: LightbulbIcon,
    class:
      "border-green-200 bg-green-50 text-green-900 dark:border-green-900 dark:bg-green-950/40 dark:text-green-100",
  },
};
</script>

<template>
  <div
    :class="config[variant].class"
    class="flex gap-2.5 rounded-md border p-3 text-sm"
  >
    <component :is="config[variant].icon" class="mt-0.5 size-4 shrink-0" />
    <div class="flex-1">
      <slot>{{ text }}</slot>
    </div>
  </div>
</template>
