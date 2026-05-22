<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed, useId } from 'vue'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
  label?: string
  for?: string
  error?: string
  hint?: string
  required?: boolean
}>()

const reactId = useId()
const controlId = computed(() => props.for ?? reactId)
const errorId = computed(() => `${controlId.value}-error`)
const hintId = computed(() => `${controlId.value}-hint`)

const describedBy = computed(() => {
  const ids: string[] = []
  if (props.hint)
    ids.push(hintId.value)
  if (props.error)
    ids.push(errorId.value)
  return ids.length ? ids.join(' ') : undefined
})

const slotBindings = computed(() => ({
  id: controlId.value,
  ariaInvalid: props.error ? true : undefined,
  ariaDescribedby: describedBy.value,
}))
</script>

<template>
  <div
    data-slot="form-field"
    :class="cn('space-y-2', props.class)"
  >
    <Label v-if="label || $slots.label" :for="controlId">
      <slot name="label">{{ label }}</slot>
      <span v-if="required" class="text-destructive">*</span>
    </Label>

    <slot v-bind="slotBindings" />

    <p v-if="hint" :id="hintId" class="text-xs text-muted-foreground">
      {{ hint }}
    </p>
    <p v-if="error" :id="errorId" class="text-xs text-destructive">
      {{ error }}
    </p>
  </div>
</template>
