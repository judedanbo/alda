<script setup lang="ts">
import type { ComboboxLabelProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { ComboboxLabel, useForwardProps } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<ComboboxLabelProps & { class?: HTMLAttributes['class'] }>()

const delegatedProps = reactiveOmit(props, 'class')
const forwarded = useForwardProps(delegatedProps)
</script>

<template>
  <ComboboxLabel
    data-slot="combobox-label"
    :class="cn('px-2 py-1.5 text-xs font-medium text-muted-foreground', props.class)"
    v-bind="forwarded"
  >
    <slot />
  </ComboboxLabel>
</template>
