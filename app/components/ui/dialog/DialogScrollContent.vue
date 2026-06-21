<script setup lang="ts">
import type { DialogContentEmits, DialogContentProps } from 'reka-ui'

import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { XIcon } from 'lucide-vue-next'
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  useForwardPropsEmits,
} from 'reka-ui'
import { cn } from '@/lib/utils'

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<DialogContentProps & { class?: HTMLAttributes['class'] }>()
const emits = defineEmits<DialogContentEmits>()

const delegatedProps = reactiveOmit(props, 'class')

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <DialogPortal>
    <DialogOverlay
      class="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
    >
      <!--
        Unlike the standard DialogContent (overlay + content are siblings), the
        scroll variant nests the content INSIDE the overlay so the backdrop can
        scroll. reka's DialogOverlay registers `@pointerdown.left.prevent`, so a
        pointerdown on a plain <input> here bubbles to the overlay and gets its
        default prevented — which suppresses the compatibility mousedown and
        stops the input from focusing on click (labels still work via `for=`).
        Stop pointerdown at the content so it never reaches the overlay handler;
        outside-click dismissal is unaffected (it keys off the pointerdown
        target being outside the content, not on bubbling through it).
      -->
      <DialogContent
        :class="
          cn(
            'relative z-50 grid w-full max-w-lg my-8 gap-4 border border-border bg-background p-6 shadow-lg duration-200 sm:rounded-lg md:w-full',
            props.class,
          )
        "
        v-bind="{ ...$attrs, ...forwarded }"
        @pointerdown.stop
        @pointer-down-outside="(event) => {
          const originalEvent = event.detail.originalEvent;
          const target = originalEvent.target as HTMLElement;
          if (originalEvent.offsetX > target.clientWidth || originalEvent.offsetY > target.clientHeight) {
            event.preventDefault();
          }
        }"
      >
        <slot />

        <DialogClose
          class="absolute top-4 right-4 p-0.5 transition-colors rounded-md hover:bg-secondary"
        >
          <XIcon class="w-4 h-4" />
          <span class="sr-only">Close</span>
        </DialogClose>
      </DialogContent>
    </DialogOverlay>
  </DialogPortal>
</template>
