<script setup lang="ts">
import type { TagsInputInputProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { TagsInputInput, useForwardProps } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<TagsInputInputProps & { class?: HTMLAttributes['class'] }>()

const delegatedProps = reactiveOmit(props, 'class')
const forwarded = useForwardProps(delegatedProps)
</script>

<template>
  <TagsInputInput
    data-slot="tags-input-input"
    :class="cn(
      'min-w-24 flex-1 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-muted-foreground',
      props.class,
    )"
    v-bind="forwarded"
  />
</template>
