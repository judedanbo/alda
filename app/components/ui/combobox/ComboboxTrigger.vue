<script setup lang="ts">
import type { ComboboxTriggerProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { ChevronsUpDownIcon } from 'lucide-vue-next'
import { ComboboxTrigger, useForwardProps } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<ComboboxTriggerProps & { class?: HTMLAttributes['class'] }>()

const delegatedProps = reactiveOmit(props, 'class')
const forwarded = useForwardProps(delegatedProps)
</script>

<template>
  <ComboboxTrigger
    data-slot="combobox-trigger"
    :class="cn(
      'flex shrink-0 items-center justify-center text-muted-foreground hover:text-foreground outline-none',
      props.class,
    )"
    v-bind="forwarded"
  >
    <slot>
      <ChevronsUpDownIcon class="size-4 opacity-60" />
    </slot>
  </ComboboxTrigger>
</template>
