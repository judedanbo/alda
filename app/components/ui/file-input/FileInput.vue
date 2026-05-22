<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const props = withDefaults(defineProps<{
  class?: HTMLAttributes['class']
  id?: string
  accept?: string
  multiple?: boolean
  disabled?: boolean
  modelValue?: File | File[] | null
  buttonLabel?: string
  placeholder?: string
}>(), {
  buttonLabel: 'Choose file',
  placeholder: 'No file selected',
})

const emits = defineEmits<{
  (e: 'update:modelValue', payload: File | File[] | null): void
  (e: 'change', payload: Event): void
}>()

const inputRef = ref<HTMLInputElement | null>(null)

const fileLabel = computed(() => {
  const value = props.modelValue
  if (!value)
    return props.placeholder
  if (Array.isArray(value)) {
    if (value.length === 0)
      return props.placeholder
    return value.length === 1 ? value[0]!.name : `${value.length} files selected`
  }
  return value.name
})

function onChange(event: Event) {
  const files = (event.target as HTMLInputElement).files
  if (!files || files.length === 0)
    emits('update:modelValue', props.multiple ? [] : null)
  else if (props.multiple)
    emits('update:modelValue', Array.from(files))
  else
    emits('update:modelValue', files[0]!)
  emits('change', event)
}

function openPicker() {
  inputRef.value?.click()
}
</script>

<template>
  <div
    data-slot="file-input"
    :class="cn('flex items-center gap-2', props.class)"
  >
    <input
      :id="id"
      ref="inputRef"
      type="file"
      :accept="accept"
      :multiple="multiple"
      :disabled="disabled"
      class="sr-only"
      @change="onChange"
    >
    <Button
      type="button"
      variant="outline"
      size="sm"
      :disabled="disabled"
      @click="openPicker"
    >
      {{ buttonLabel }}
    </Button>
    <span class="truncate text-sm text-muted-foreground">{{ fileLabel }}</span>
  </div>
</template>
