<script setup lang="ts">
import { ref } from 'vue'
import { UserPlus, FileText, Search, CheckCircle } from 'lucide-vue-next'
import { useScrollAnimation } from '~/composables/useScrollAnimation'

const steps = [
  {
    icon: UserPlus,
    title: 'Register',
    description: 'Create an account with your email and Ghana Card details',
  },
  {
    icon: FileText,
    title: 'Submit',
    description: 'Complete and submit your asset declaration form',
  },
  {
    icon: Search,
    title: 'Review',
    description:
      'Your declaration is reviewed by the Legal Unit and Audit Officers',
  },
  {
    icon: CheckCircle,
    title: 'Receive',
    description:
      'Get your receipt once your declaration is approved and sealed',
  },
]

const sectionRef = ref<HTMLElement | null>(null)
const { isVisible } = useScrollAnimation(sectionRef, { threshold: 0.15 })
</script>

<template>
  <section id="how-it-works" ref="sectionRef" class="py-20 bg-muted/30">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-16">
        <h2 class="text-3xl font-bold text-foreground mb-4">How It Works</h2>
        <p class="text-muted-foreground max-w-2xl mx-auto">
          Complete your asset declaration in four simple steps
        </p>
      </div>

      <!-- Desktop: horizontal timeline -->
      <div class="hidden md:flex items-start gap-0 relative px-4">
        <template v-for="(step, index) in steps" :key="step.title">
          <!-- Step card -->
          <div
            class="flex-1 text-center transition-all duration-500"
            :class="
              isVisible
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-8'
            "
            :style="{
              transitionDelay: isVisible ? `${index * 150}ms` : '0ms',
            }"
          >
            <div
              class="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25"
            >
              <component :is="step.icon" class="size-6 text-primary-foreground" />
            </div>
            <h3 class="font-semibold text-foreground mb-1">{{ step.title }}</h3>
            <p class="text-sm text-muted-foreground leading-relaxed px-2">
              {{ step.description }}
            </p>
          </div>

          <!-- Connector (between steps, not after last) -->
          <div
            v-if="index < steps.length - 1"
            class="w-16 min-w-16 h-0.5 bg-gradient-to-r from-primary to-primary/60 mt-7 relative shrink-0"
          >
            <div
              class="absolute -right-1 -top-[3px] w-2 h-2 rounded-full bg-primary/60"
            />
          </div>
        </template>
      </div>

      <!-- Mobile: vertical timeline -->
      <div class="md:hidden space-y-8 relative pl-12">
        <!-- Vertical line -->
        <div
          class="absolute left-[22px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary to-primary/30"
        />

        <div
          v-for="(step, index) in steps"
          :key="step.title"
          class="relative transition-all duration-500"
          :class="
            isVisible
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-8'
          "
          :style="{ transitionDelay: isVisible ? `${index * 150}ms` : '0ms' }"
        >
          <div
            class="absolute -left-12 w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25"
          >
            <component :is="step.icon" class="size-5 text-primary-foreground" />
          </div>
          <h3 class="font-semibold text-foreground mb-1">{{ step.title }}</h3>
          <p class="text-sm text-muted-foreground leading-relaxed">
            {{ step.description }}
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
