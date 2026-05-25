<script setup lang="ts">
import type { ComboboxGroupProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { ComboboxGroup, useForwardProps } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<ComboboxGroupProps & { class?: HTMLAttributes['class'] }>()

const delegatedProps = reactiveOmit(props, 'class')
const forwarded = useForwardProps(delegatedProps)
</script>

<template>
  <ComboboxGroup
    data-slot="combobox-group"
    :class="cn('overflow-hidden p-1 text-foreground [&_[data-slot=combobox-label]]:px-2 [&_[data-slot=combobox-label]]:py-1.5 [&_[data-slot=combobox-label]]:text-xs [&_[data-slot=combobox-label]]:font-medium [&_[data-slot=combobox-label]]:text-muted-foreground', props.class)"
    v-bind="forwarded"
  >
    <slot />
  </ComboboxGroup>
</template>
