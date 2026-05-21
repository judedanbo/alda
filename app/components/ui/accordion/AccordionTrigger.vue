<script setup lang="ts">
import type { AccordionTriggerProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { reactiveOmit } from "@vueuse/core";
import { AccordionHeader, AccordionTrigger, useForwardProps } from "reka-ui";
import { ChevronDownIcon } from "lucide-vue-next";
import { cn } from "@/lib/utils";

const props = defineProps<
  AccordionTriggerProps & { class?: HTMLAttributes["class"] }
>();

const delegatedProps = reactiveOmit(props, "class");
const forwarded = useForwardProps(delegatedProps);
</script>

<template>
  <AccordionHeader class="flex">
    <AccordionTrigger
      data-slot="accordion-trigger"
      v-bind="forwarded"
      :class="cn('flex flex-1 items-center justify-between gap-4 py-4 text-left text-sm font-medium outline-none transition-all hover:underline focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:rotate-180', props.class)"
    >
      <slot />
      <ChevronDownIcon
        class="text-muted-foreground size-4 shrink-0 transition-transform duration-200"
      />
    </AccordionTrigger>
  </AccordionHeader>
</template>
