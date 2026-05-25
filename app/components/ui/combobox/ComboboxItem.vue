<script setup lang="ts">
import type { ComboboxItemEmits, ComboboxItemProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { CheckIcon } from 'lucide-vue-next'
import { ComboboxItem, ComboboxItemIndicator, useForwardPropsEmits } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<ComboboxItemProps & { class?: HTMLAttributes['class'] }>()
const emits = defineEmits<ComboboxItemEmits>()

const delegatedProps = reactiveOmit(props, 'class')
const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <ComboboxItem
    data-slot="combobox-item"
    :class="cn(
      'relative flex w-full cursor-default items-center gap-2 rounded-md py-1.5 pr-2 pl-2 text-sm outline-none',
      'data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      props.class,
    )"
    v-bind="forwarded"
  >
    <span class="flex size-4 items-center justify-center text-primary">
      <ComboboxItemIndicator>
        <CheckIcon class="size-4" />
      </ComboboxItemIndicator>
    </span>
    <slot />
  </ComboboxItem>
</template>
