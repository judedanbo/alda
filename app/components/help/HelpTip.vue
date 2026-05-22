<script setup lang="ts">
import { CircleHelpIcon } from "lucide-vue-next";
import { getFieldTooltip } from "~/help";

// Inline hint icon for a form field. Pass `fieldId` to resolve text from
// app/help/tooltips.ts, or pass `text` directly. Self-contained — it provides
// its own TooltipProvider so it works in any form.
const props = defineProps<{
  fieldId?: string;
  text?: string;
  label?: string;
}>();

const content = computed(
  () =>
    (props.fieldId ? getFieldTooltip(props.fieldId) : undefined) ??
    props.text ??
    "",
);
</script>

<template>
  <TooltipProvider v-if="content" :delay-duration="150">
    <Tooltip>
      <TooltipTrigger as-child>
        <button
          type="button"
          class="text-muted-foreground hover:text-foreground inline-flex shrink-0 cursor-help align-middle transition-colors focus-visible:outline-none"
          :aria-label="label ?? 'More information'"
        >
          <CircleHelpIcon class="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <span class="block max-w-[16rem] leading-snug">{{ content }}</span>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>
