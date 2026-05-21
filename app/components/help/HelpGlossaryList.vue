<script setup lang="ts">
import type { GlossaryTerm } from "~/help";

defineProps<{ terms: GlossaryTerm[] }>();
</script>

<template>
  <dl class="divide-y">
    <div
      v-for="term in terms"
      :id="term.id"
      :key="term.id"
      class="scroll-mt-24 py-4 first:pt-0 last:pb-0"
    >
      <dt class="text-foreground font-semibold">{{ term.term }}</dt>
      <dd class="text-muted-foreground mt-1 text-sm leading-relaxed">
        {{ term.definition }}
      </dd>
    </div>
  </dl>
</template>
