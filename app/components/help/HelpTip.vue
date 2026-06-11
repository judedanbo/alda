<script setup lang="ts">
import { CircleHelpIcon } from "lucide-vue-next";
import { getFieldTooltip } from "~/help";

// Inline hint icon for a form field. Pass `fieldId` to resolve text from
// app/help/tooltips.ts, or pass `text` directly. Opens on click/tap (not
// hover) via a popover, so it works reliably on touch devices. Self-contained
// — drop it next to any label.
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
  <Popover v-if="content">
    <PopoverTrigger as-child>
      <button
        type="button"
        class="text-muted-foreground hover:text-foreground inline-flex shrink-0 cursor-help align-middle transition-colors focus-visible:outline-none"
        :aria-label="label ?? 'More information'"
      >
        <CircleHelpIcon class="size-3.5" />
      </button>
    </PopoverTrigger>
    <PopoverContent class="w-64 p-3" :side-offset="6">
      <span class="block text-sm leading-snug text-popover-foreground">{{ content }}</span>
    </PopoverContent>
  </Popover>
</template>
