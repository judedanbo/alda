<script setup lang="ts">
import type { ComboboxEmptyProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { ComboboxEmpty, useForwardProps } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<ComboboxEmptyProps & { class?: HTMLAttributes['class'] }>()

const delegatedProps = reactiveOmit(props, 'class')
const forwarded = useForwardProps(delegatedProps)
</script>

<template>
  <ComboboxEmpty
    data-slot="combobox-empty"
    :class="cn('py-6 text-center text-sm text-muted-foreground', props.class)"
    v-bind="forwarded"
  >
    <slot>No results found.</slot>
  </ComboboxEmpty>
</template>
