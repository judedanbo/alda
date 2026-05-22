<script setup lang="ts">
import { ArrowRightIcon } from "lucide-vue-next";
import type { HelpBlock } from "~/help";
import { getGuideById } from "~/help";

defineProps<{ blocks: HelpBlock[] }>();
</script>

<template>
  <div class="space-y-4">
    <template v-for="(block, i) in blocks" :key="i">
      <p
        v-if="block.type === 'paragraph'"
        class="text-muted-foreground text-sm leading-relaxed"
      >
        {{ block.text }}
      </p>

      <h3
        v-else-if="block.type === 'heading'"
        class="text-foreground pt-1 text-base font-semibold"
      >
        {{ block.text }}
      </h3>

      <ul
        v-else-if="block.type === 'list' && block.ordered"
        class="text-muted-foreground ml-1 list-decimal space-y-1.5 pl-4 text-sm"
      >
        <li v-for="(item, j) in block.items" :key="j">{{ item }}</li>
      </ul>

      <ul
        v-else-if="block.type === 'list'"
        class="text-muted-foreground ml-1 list-disc space-y-1.5 pl-4 text-sm"
      >
        <li v-for="(item, j) in block.items" :key="j">{{ item }}</li>
      </ul>

      <HelpNote
        v-else-if="block.type === 'note'"
        :variant="block.variant"
        :text="block.text"
      />

      <div
        v-else-if="block.type === 'steps' && getGuideById(block.guideId)"
        class="bg-muted/30 rounded-lg border p-4"
      >
        <HelpGuideSteps :steps="getGuideById(block.guideId)!.steps" />
      </div>

      <a
        v-else-if="block.type === 'link' && block.external"
        :href="block.to"
        target="_blank"
        rel="noopener noreferrer"
        class="text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline"
      >
        {{ block.label }}
        <ArrowRightIcon class="size-3.5" />
      </a>
      <NuxtLink
        v-else-if="block.type === 'link'"
        :to="block.to"
        class="text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline"
      >
        {{ block.label }}
        <ArrowRightIcon class="size-3.5" />
      </NuxtLink>
    </template>
  </div>
</template>
