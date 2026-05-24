<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { useVModel } from '@vueuse/core'
import { ChevronDownIcon } from 'lucide-vue-next'
import { cn } from '@/lib/utils'

const props = defineProps<{
  modelValue?: string | number | null
  defaultValue?: string | number
  class?: HTMLAttributes['class']
  id?: string
  disabled?: boolean
  size?: 'sm' | 'default'
}>()

const emits = defineEmits<{
  (e: 'update:modelValue', payload: string | number): void
}>()

const modelValue = useVModel(props, 'modelValue', emits, {
  passive: true,
  defaultValue: props.defaultValue,
})
</script>

<template>
  <div
    data-slot="native-select"
    :data-size="size ?? 'default'"
    :class="cn(
      'relative inline-flex w-fit items-center',
      props.class,
    )"
  >
    <select
      :id="id"
      v-model="modelValue"
      :disabled="disabled"
      :class="cn(
        'border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50',
        'appearance-none rounded-lg border bg-transparent pr-7 pl-2.5 text-sm transition-colors focus-visible:ring-3 aria-invalid:ring-3 outline-none disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-7' : 'h-8',
        'min-w-0',
      )"
    >
      <slot />
    </select>
    <ChevronDownIcon class="pointer-events-none absolute right-2 size-4 text-muted-foreground" />
  </div>
</template>
