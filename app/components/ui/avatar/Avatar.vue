<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import type { AvatarVariants } from '.'
import { AvatarFallback, AvatarImage, AvatarRoot } from 'reka-ui'
import { computed } from 'vue'
import { cn } from '@/lib/utils'
import { avatarVariants } from '.'

const props = defineProps<{
  class?: HTMLAttributes['class']
  src?: string
  name?: string
  size?: AvatarVariants['size']
}>()

const initials = computed(() => {
  if (!props.name)
    return ''
  return props.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('')
})
</script>

<template>
  <AvatarRoot
    data-slot="avatar"
    :data-size="size"
    :class="cn(avatarVariants({ size }), props.class)"
  >
    <AvatarImage
      v-if="src"
      :src="src"
      :alt="name"
      class="aspect-square size-full object-cover"
    />
    <AvatarFallback
      data-slot="avatar-fallback"
      class="flex size-full items-center justify-center bg-primary/10 font-semibold text-primary"
    >
      <slot>{{ initials }}</slot>
    </AvatarFallback>
  </AvatarRoot>
</template>
