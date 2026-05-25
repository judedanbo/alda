<script setup lang="ts">
import type { TagsInputRootEmits, TagsInputRootProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { reactiveOmit } from '@vueuse/core'
import { TagsInputRoot, useForwardPropsEmits } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<TagsInputRootProps & { class?: HTMLAttributes['class'] }>()
const emits = defineEmits<TagsInputRootEmits>()

const delegatedProps = reactiveOmit(props, 'class')
const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <TagsInputRoot
    data-slot="tags-input"
    :class="cn(
      'border-input dark:bg-input/30 focus-within:border-ring focus-within:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50',
      'flex min-h-8 flex-wrap items-center gap-1 rounded-lg border bg-transparent px-2 py-1 transition-colors focus-within:ring-3 aria-invalid:ring-3',
      props.class,
    )"
    v-bind="forwarded"
  >
    <slot />
  </TagsInputRoot>
</template>
