<script setup lang="ts">
import { Shield, Scale, Landmark, BookText } from 'lucide-vue-next'

const items = [
  {
    icon: Scale,
    title: 'Constitutional Mandate',
    subtitle: 'Article 286(5), 1992',
  },
  {
    icon: BookText,
    title: 'Act 550 of 1998',
    subtitle: 'Statutory framework',
  },
  {
    icon: Landmark,
    title: 'Ghana Audit Service',
    subtitle: 'Official operating authority',
    emphasis: true,
  },
  {
    icon: Shield,
    title: 'Secure & Auditable',
    subtitle: 'Tamper-proof declaration trail',
  },
]
</script>

<template>
  <section class="bg-primary/5 border-y border-border">
    <div
      class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
    >
      <div
        v-for="item in items"
        :key="item.title"
        class="flex items-center gap-3 rounded-xl p-3 transition-colors"
        :class="
          item.emphasis
            ? 'bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20'
            : ''
        "
      >
        <div
          class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          :class="
            item.emphasis
              ? 'bg-white/15 text-primary-foreground'
              : 'bg-primary/10 text-primary'
          "
        >
          <component :is="item.icon" class="size-5" />
        </div>
        <div>
          <div
            class="font-semibold text-sm"
            :class="item.emphasis ? 'text-primary-foreground' : 'text-foreground'"
          >
            {{ item.title }}
          </div>
          <div
            class="text-xs"
            :class="
              item.emphasis ? 'text-primary-foreground/80' : 'text-muted-foreground'
            "
          >
            {{ item.subtitle }}
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
