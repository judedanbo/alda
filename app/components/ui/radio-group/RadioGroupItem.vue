<script setup lang="ts">
import type { RadioGroupItemProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { CircleIcon } from 'lucide-vue-next'
import { RadioGroupIndicator, RadioGroupItem, useForwardProps } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<RadioGroupItemProps & { class?: HTMLAttributes['class'] }>()

const delegatedProps = reactiveOmit(props, 'class')
const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <RadioGroupItem
    data-slot="radio-group-item"
    :class="cn(
      'border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50',
      'aspect-square size-4 shrink-0 rounded-full border outline-none transition-colors focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50',
      props.class,
    )"
    v-bind="forwardedProps"
  >
    <RadioGroupIndicator class="relative flex items-center justify-center after:absolute after:inset-0 after:flex after:items-center after:justify-center">
      <CircleIcon class="size-2 fill-primary text-primary" />
    </RadioGroupIndicator>
  </RadioGroupItem>
</template>
