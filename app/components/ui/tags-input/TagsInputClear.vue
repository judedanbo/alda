<script setup lang="ts">
import type { TagsInputClearProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { TagsInputClear, useForwardProps } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<TagsInputClearProps & { class?: HTMLAttributes['class'] }>()

const delegatedProps = reactiveOmit(props, 'class')
const forwarded = useForwardProps(delegatedProps)
</script>

<template>
  <TagsInputClear
    data-slot="tags-input-clear"
    :class="cn('text-xs text-muted-foreground hover:text-foreground outline-none', props.class)"
    v-bind="forwarded"
  >
    <slot>Clear</slot>
  </TagsInputClear>
</template>
