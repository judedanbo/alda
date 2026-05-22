<script setup lang="ts">
import type { Component, HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
  title: string
  description?: string
  icon?: Component
}>()
</script>

<template>
  <div
    data-slot="empty-state"
    :class="cn('flex flex-col items-center justify-center py-12 text-center', props.class)"
  >
    <div
      v-if="icon || $slots.icon"
      class="mb-3 text-muted-foreground [&>svg]:size-12"
    >
      <slot name="icon">
        <component :is="icon" />
      </slot>
    </div>
    <h3 class="text-lg font-medium text-foreground">
      {{ title }}
    </h3>
    <p
      v-if="description || $slots.default"
      class="mt-1 text-sm text-muted-foreground"
    >
      <slot>{{ description }}</slot>
    </p>
    <div v-if="$slots.action" class="mt-4">
      <slot name="action" />
    </div>
  </div>
</template>
