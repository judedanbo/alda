<script setup lang="ts">
import type { TagsInputItemDeleteProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { XIcon } from 'lucide-vue-next'
import { TagsInputItemDelete, useForwardProps } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<TagsInputItemDeleteProps & { class?: HTMLAttributes['class'] }>()

const delegatedProps = reactiveOmit(props, 'class')
const forwarded = useForwardProps(delegatedProps)
</script>

<template>
  <TagsInputItemDelete
    data-slot="tags-input-item-delete"
    :class="cn(
      '-mr-0.5 inline-flex size-4 items-center justify-center rounded-sm opacity-60 outline-none hover:opacity-100',
      props.class,
    )"
    v-bind="forwarded"
  >
    <slot>
      <XIcon class="size-3" />
    </slot>
  </TagsInputItemDelete>
</template>
