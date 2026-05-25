<script setup lang="ts">
import type { ComboboxContentEmits, ComboboxContentProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import {
  ComboboxContent,
  ComboboxPortal,
  ComboboxViewport,
  useForwardPropsEmits,
} from 'reka-ui'
import { cn } from '@/lib/utils'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<ComboboxContentProps & { class?: HTMLAttributes['class'] }>(),
  {
    position: 'popper',
    align: 'start',
    sideOffset: 4,
  },
)
const emits = defineEmits<ComboboxContentEmits>()

const delegatedProps = reactiveOmit(props, 'class')
const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <ComboboxPortal>
    <ComboboxContent
      data-slot="combobox-content"
      v-bind="{ ...$attrs, ...forwarded }"
      :class="cn(
        'data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        'ring-foreground/10 bg-popover text-popover-foreground min-w-36 rounded-lg p-1 shadow-md ring-1 duration-100 cn-menu-translucent z-50',
        'max-h-(--reka-combobox-content-available-height) w-(--reka-combobox-trigger-width) origin-(--reka-combobox-content-transform-origin)',
        props.class,
      )"
    >
      <ComboboxViewport class="max-h-72 overflow-x-hidden overflow-y-auto">
        <slot />
      </ComboboxViewport>
    </ComboboxContent>
  </ComboboxPortal>
</template>
