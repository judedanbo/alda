<script setup lang="ts">
import { CheckIcon } from "lucide-vue-next";
import type { HelpGuideStep } from "~/help";

defineProps<{ steps: HelpGuideStep[] }>();
</script>

<template>
  <!-- Journey rail: numbered green nodes joined by a vertical spine, ending in
       a gold "goal" node. The connector runs through each step's bottom
       padding so consecutive nodes stay visually linked. -->
  <ol class="relative">
    <li
      v-for="(step, i) in steps"
      :key="i"
      class="flex gap-4 pb-6 last:pb-0"
    >
      <div class="relative flex flex-col items-center">
        <div
          class="ring-background flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ring-4"
          :class="
            i === steps.length - 1
              ? 'bg-secondary text-secondary-foreground'
              : 'bg-primary text-primary-foreground'
          "
        >
          <CheckIcon v-if="i === steps.length - 1" class="size-4" />
          <template v-else>{{ i + 1 }}</template>
        </div>
        <span
          v-if="i < steps.length - 1"
          class="bg-border mt-1 w-px flex-1"
          aria-hidden="true"
        />
      </div>

      <div class="flex-1 space-y-1.5 pt-1">
        <p class="text-foreground font-medium">{{ step.title }}</p>
        <p class="text-muted-foreground text-sm">{{ step.detail }}</p>
        <HelpNote
          v-if="step.note"
          :variant="step.note.variant"
          :text="step.note.text"
          class="mt-2"
        />
      </div>
    </li>
  </ol>
</template>
