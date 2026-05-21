<script setup lang="ts">
import type { HelpGuideStep } from "~/help";

defineProps<{ steps: HelpGuideStep[] }>();
</script>

<template>
  <ol class="space-y-5">
    <li v-for="(step, i) in steps" :key="i" class="flex gap-4">
      <div
        class="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
      >
        {{ i + 1 }}
      </div>
      <div class="flex-1 space-y-1.5 pt-0.5">
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
