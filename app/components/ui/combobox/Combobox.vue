<script setup lang="ts">
import type { ComboboxRootEmits, ComboboxRootProps } from 'reka-ui'
import { ComboboxRoot, useForwardPropsEmits } from 'reka-ui'

const props = defineProps<ComboboxRootProps<unknown>>()
const emits = defineEmits<ComboboxRootEmits<unknown>>()

const forwarded = useForwardPropsEmits(props, emits)
</script>

<template>
  <ComboboxRoot data-slot="combobox" v-bind="forwarded as object">
    <slot />
  </ComboboxRoot>
</template>
