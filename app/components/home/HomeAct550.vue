<script setup lang="ts">
import { ref } from 'vue'
import {
  Scale,
  CalendarClock,
  Building,
  AlertTriangle,
  ScrollText,
  CheckCircle2,
} from 'lucide-vue-next'
import { useScrollAnimation } from '~/composables/useScrollAnimation'

const sectionRef = ref<HTMLElement | null>(null)
const { isVisible } = useScrollAnimation(sectionRef, { threshold: 0.1 })

const pillars = [
  {
    icon: CalendarClock,
    title: 'When to declare',
    detail:
      'Before taking office, at the end of every four years, and at the end of the term — within six months of the event (Section 1(4)).',
  },
  {
    icon: ScrollText,
    title: 'What to declare',
    detail:
      'All properties and all liabilities — lands, houses, farms, concessions, vehicles, business interests, securities, bank balances, bonds, insurance, jewellery and objects of art (Section 4).',
  },
  {
    icon: Building,
    title: 'Where it goes',
    detail:
      'The written declaration is submitted to the Auditor-General on the Schedule II form (Section 1(1)–(2)).',
  },
  {
    icon: AlertTriangle,
    title: 'Consequences',
    detail:
      'Failure to declare, or knowingly making a false declaration, is a contravention. Complaints go to CHRAJ for investigation (Sections 7–8). Assets acquired afterwards that cannot be reasonably accounted for are regarded as acquired illegally (Section 5).',
  },
]
</script>

<template>
  <section id="about-act-550" ref="sectionRef" class="py-16 sm:py-20">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
        <!-- Left: framing -->
        <div
          class="transition-all duration-500"
          :class="
            isVisible
              ? 'opacity-100 translate-x-0'
              : 'opacity-0 -translate-x-6'
          "
        >
          <span
            class="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium tracking-wide text-primary mb-5"
          >
            <Scale class="size-3.5" /> THE LAW
          </span>
          <h2 class="text-3xl sm:text-4xl font-bold text-foreground mb-5 leading-tight">
            The Public Office Holders (Declaration of Assets and
            Disqualification) Act, 1998 — Act 550
          </h2>
          <p class="text-muted-foreground leading-relaxed mb-4">
            Act 550 gives effect to Chapter 24 of the 1992 Constitution. It
            sets out who must declare, what must be declared, when declarations
            are due, and the consequences for non-compliance or false
            declarations.
          </p>
          <p class="text-muted-foreground leading-relaxed mb-6">
            This portal is the digital service through which the Ghana Audit
            Service receives, records, reviews, and seals declarations made
            under the Act.
          </p>
          <div class="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span
              class="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1"
            >
              <CheckCircle2 class="size-3.5 text-primary" />
              Assented 4 May 1998
            </span>
            <span
              class="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1"
            >
              <CheckCircle2 class="size-3.5 text-primary" />
              Gazetted 8 May 1998
            </span>
            <span
              class="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1"
            >
              <CheckCircle2 class="size-3.5 text-primary" />
              16 sections, 2 Schedules
            </span>
          </div>
        </div>

        <!-- Right: four pillars -->
        <div class="grid sm:grid-cols-2 gap-4">
          <div
            v-for="(p, index) in pillars"
            :key="p.title"
            class="rounded-xl border bg-card p-5 transition-all duration-500"
            :class="
              isVisible
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-6'
            "
            :style="{ transitionDelay: isVisible ? `${index * 100}ms` : '0ms' }"
          >
            <div
              class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3"
            >
              <component :is="p.icon" class="size-5 text-primary" />
            </div>
            <h3 class="font-semibold text-foreground mb-1.5">{{ p.title }}</h3>
            <p class="text-sm text-muted-foreground leading-relaxed">
              {{ p.detail }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
