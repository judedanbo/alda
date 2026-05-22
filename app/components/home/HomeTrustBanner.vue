<script setup lang="ts">
import { Shield, Scale, Landmark, ClipboardList } from 'lucide-vue-next'

const items = [
  {
    icon: Shield,
    title: 'Secure & Confidential',
    subtitle: 'End-to-end encrypted',
  },
  {
    icon: Scale,
    title: 'Constitutional Mandate',
    subtitle: 'Article 286(5), 1992',
  },
  {
    icon: Landmark,
    title: 'Ghana Audit Service',
    subtitle: 'Official government portal',
  },
  {
    icon: ClipboardList,
    title: 'Tracked & Auditable',
    subtitle: 'Full declaration trail',
  },
]
</script>

<template>
  <section class="bg-primary/5 border-y border-border">
    <div
      class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
    >
      <div
        v-for="item in items"
        :key="item.title"
        class="flex items-center gap-3"
      >
        <div
          class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0"
        >
          <component :is="item.icon" class="size-5 text-primary" />
        </div>
        <div>
          <div class="font-semibold text-sm text-foreground">
            {{ item.title }}
          </div>
          <div class="text-xs text-muted-foreground">{{ item.subtitle }}</div>
        </div>
      </div>
    </div>
  </section>
</template>
