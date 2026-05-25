<script setup lang="ts">
import type { ComboboxSeparatorProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { ComboboxSeparator, useForwardProps } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<ComboboxSeparatorProps & { class?: HTMLAttributes['class'] }>()

const delegatedProps = reactiveOmit(props, 'class')
const forwarded = useForwardProps(delegatedProps)
</script>

<template>
  <ComboboxSeparator
    data-slot="combobox-separator"
    :class="cn('-mx-1 my-1 h-px bg-border', props.class)"
    v-bind="forwarded"
  >
    <slot />
  </ComboboxSeparator>
</template>
