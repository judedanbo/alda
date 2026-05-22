# Home Page Full Creative Rebuild — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the ADLA home page with theme-adaptive design, kente-inspired visuals, scroll animations, and interactive sections (tabs, accordion) that work flawlessly across all 6 color themes.

**Architecture:** Split the monolithic `index.vue` into 7 focused Vue components under `app/components/home/`. A shared `useScrollAnimation` composable handles IntersectionObserver-based entrance animations. All styling uses Tailwind semantic tokens for automatic theme adaptation. Existing shadcn-vue Tabs and Accordion components are reused.

**Tech Stack:** Nuxt 4, Vue 3 Composition API, Tailwind CSS v4, shadcn-vue (reka-ui), Lucide icons, @vueuse/core (useIntersectionObserver, useWindowScroll, usePreferredReducedMotion)

**Spec:** `docs/superpowers/specs/2026-05-22-home-page-refresh-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `app/composables/useScrollAnimation.ts` | Create | Reusable IntersectionObserver composable for scroll-triggered entrance animations |
| `app/components/home/KentePattern.vue` | Create | Inline SVG kente pattern with configurable opacity |
| `app/components/home/HomeHero.vue` | Create | Split-layout hero with kente texture, parallax, CTAs |
| `app/components/home/HomeTrustBanner.vue` | Create | Horizontal trust indicators strip |
| `app/components/home/HomeTimeline.vue` | Create | 4-step visual timeline with scroll animation |
| `app/components/home/HomeDeclarers.vue` | Create | Tabbed "Who Must Declare" explorer |
| `app/components/home/HomeFaq.vue` | Create | FAQ accordion section |
| `app/components/home/HomeFooter.vue` | Create | 4-column footer with tricolor accent |
| `app/pages/index.vue` | Rewrite | Orchestrate all section components |

---

## Task 1: Create `useScrollAnimation` Composable

**Files:**
- Create: `app/composables/useScrollAnimation.ts`

This composable provides the scroll-triggered fade-in-up animation used by multiple sections. Build it first so downstream components can import it.

- [ ] **Step 1: Create the composable**

```ts
// app/composables/useScrollAnimation.ts
import { useIntersectionObserver, usePreferredReducedMotion } from '@vueuse/core'
import { ref, type Ref } from 'vue'

export function useScrollAnimation(
  target: Ref<HTMLElement | null>,
  options: { threshold?: number; delay?: number } = {},
) {
  const { threshold = 0.2, delay = 0 } = options
  const isVisible = ref(false)
  const prefersReducedMotion = usePreferredReducedMotion()

  useIntersectionObserver(
    target,
    ([entry]) => {
      if (entry?.isIntersecting) {
        if (prefersReducedMotion.value === 'reduce') {
          isVisible.value = true
        } else {
          setTimeout(() => {
            isVisible.value = true
          }, delay)
        }
      }
    },
    { threshold },
  )

  return { isVisible, prefersReducedMotion }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /home/jude/code/alda/app && npx nuxi typecheck`

Expected: No errors related to `useScrollAnimation`

- [ ] **Step 3: Commit**

```bash
cd /home/jude/code/alda && git add app/composables/useScrollAnimation.ts
git commit -m "feat(home): add useScrollAnimation composable for scroll-triggered entrance animations"
```

---

## Task 2: Create `KentePattern` Component

**Files:**
- Create: `app/components/home/KentePattern.vue`

Reusable inline SVG kente-inspired pattern. Used by hero and potentially other sections.

- [ ] **Step 1: Create the component**

```vue
<!-- app/components/home/KentePattern.vue -->
<script setup lang="ts">
withDefaults(defineProps<{
  opacity?: number
  patternSize?: number
}>(), {
  opacity: 0.06,
  patternSize: 40,
})
</script>

<template>
  <div class="absolute inset-0 pointer-events-none" :style="{ opacity }">
    <svg
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="kente"
          x="0"
          y="0"
          :width="patternSize"
          :height="patternSize"
          patternUnits="userSpaceOnUse"
        >
          <rect
            :width="patternSize / 2"
            :height="patternSize / 2"
            fill="#FCD116"
          />
          <rect
            :x="patternSize / 2"
            :y="patternSize / 2"
            :width="patternSize / 2"
            :height="patternSize / 2"
            fill="#FCD116"
          />
          <rect
            :x="patternSize / 2"
            :width="patternSize / 2"
            :height="patternSize / 2"
            fill="#CE1126"
          />
          <rect
            :y="patternSize / 2"
            :width="patternSize / 2"
            :height="patternSize / 2"
            fill="#CE1126"
          />
          <line
            x1="0"
            y1="0"
            :x2="patternSize"
            :y2="patternSize"
            stroke="white"
            stroke-width="1"
          />
          <line
            :x1="patternSize"
            y1="0"
            x2="0"
            :y2="patternSize"
            stroke="white"
            stroke-width="1"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#kente)" />
    </svg>
  </div>
</template>
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /home/jude/code/alda/app && npx nuxi typecheck`

Expected: No errors related to `KentePattern`

- [ ] **Step 3: Commit**

```bash
cd /home/jude/code/alda && git add app/components/home/KentePattern.vue
git commit -m "feat(home): add KentePattern SVG component"
```

---

## Task 3: Create `HomeHero` Component

**Files:**
- Create: `app/components/home/HomeHero.vue`

Split-layout hero with kente texture, parallax scroll, decorative emblem, institution badge, and two CTAs.

- [ ] **Step 1: Create the component**

```vue
<!-- app/components/home/HomeHero.vue -->
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { usePreferredReducedMotion } from '@vueuse/core'
import { Mouse } from 'lucide-vue-next'

const prefersReducedMotion = usePreferredReducedMotion()
const scrollY = ref(0)

function onScroll() {
  scrollY.value = window.scrollY
}

onMounted(() => {
  if (prefersReducedMotion.value !== 'reduce') {
    window.addEventListener('scroll', onScroll, { passive: true })
  }
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <section class="relative overflow-hidden bg-primary text-primary-foreground">
    <!-- Kente pattern with parallax -->
    <div
      class="absolute inset-0 transition-none"
      :style="{
        transform:
          prefersReducedMotion !== 'reduce'
            ? `translateY(${scrollY * 0.3}px)`
            : undefined,
      }"
    >
      <HomeKentePattern :opacity="0.06" />
    </div>

    <!-- Content -->
    <div class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <!-- Nav -->
      <nav class="flex items-center justify-between py-6">
        <div class="flex items-center gap-3">
          <div
            class="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center"
          >
            <NuxtLink to="/" class="font-bold text-xl">GH</NuxtLink>
          </div>
          <div>
            <h1 class="text-lg font-semibold">Asset Declaration Portal</h1>
            <p class="text-primary-foreground/80 text-sm">
              Audit Service — Republic of Ghana
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <AppThemeSwitcherButton />
          <Button
            variant="link"
            as-child
            class="text-primary-foreground hover:text-primary-foreground/80"
          >
            <NuxtLink to="/auth/login">Sign in</NuxtLink>
          </Button>
          <Button variant="secondary" as-child>
            <NuxtLink to="/auth/register">Create account</NuxtLink>
          </Button>
        </div>
      </nav>

      <!-- Hero body: split layout -->
      <div class="flex items-center py-20 lg:py-28">
        <!-- Left: text content -->
        <div class="flex-1 text-center md:text-left">
          <span
            class="inline-block rounded-full border border-[#FCD116]/30 bg-[#FCD116]/15 px-4 py-1 text-xs font-medium tracking-wide text-[#FCD116] mb-6"
          >
            REPUBLIC OF GHANA
          </span>
          <h2 class="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            Asset Declaration<br />System
          </h2>
          <p
            class="text-lg text-primary-foreground/75 max-w-lg mb-8 leading-relaxed"
            :class="{ 'mx-auto md:mx-0': true }"
          >
            Online portal for public officials to submit their asset
            declarations as required under Article 286(5) of the 1992
            Constitution of Ghana.
          </p>
          <div class="flex items-center gap-4 justify-center md:justify-start">
            <Button
              size="lg"
              as-child
              class="bg-[#FCD116] text-gray-900 hover:bg-[#FCD116]/90 font-semibold"
            >
              <NuxtLink to="/auth/register">Start Declaration</NuxtLink>
            </Button>
            <Button
              size="lg"
              variant="outline"
              as-child
              class="border-white/50 text-primary-foreground hover:bg-white/10 hover:text-primary-foreground"
            >
              <a href="#how-it-works">Learn More ↓</a>
            </Button>
          </div>
        </div>

        <!-- Right: decorative emblem (hidden on mobile) -->
        <div
          class="hidden md:flex flex-[0.6] items-center justify-center relative"
          :style="{
            transform:
              prefersReducedMotion !== 'reduce'
                ? `translateY(${scrollY * -0.1}px)`
                : undefined,
          }"
        >
          <div
            class="w-52 h-52 lg:w-64 lg:h-64 rounded-full border-[3px] border-[#FCD116]/20 flex items-center justify-center"
          >
            <div
              class="w-40 h-40 lg:w-48 lg:h-48 rounded-full border-2 border-[#FCD116]/12 flex items-center justify-center"
            >
              <span class="text-6xl lg:text-7xl text-[#FCD116]/25">★</span>
            </div>
          </div>
          <!-- Floating dots -->
          <div
            class="absolute top-8 right-8 w-2 h-2 rounded-full bg-[#FCD116]/20"
          />
          <div
            class="absolute bottom-16 right-12 w-1.5 h-1.5 rounded-full bg-[#CE1126]/20"
          />
          <div
            class="absolute top-20 left-4 w-1.5 h-1.5 rounded-full bg-white/15"
          />
        </div>
      </div>
    </div>

    <!-- Scroll indicator -->
    <div
      class="absolute bottom-6 left-1/2 -translate-x-1/2 opacity-40 animate-bounce"
      aria-hidden="true"
    >
      <Mouse class="size-6" />
    </div>
  </section>
</template>
```

- [ ] **Step 2: Run dev server and verify hero renders**

Run: `cd /home/jude/code/alda/app && npx nuxi typecheck`

Expected: No type errors. (Visual verification happens after the full page is wired up in Task 9.)

- [ ] **Step 3: Commit**

```bash
cd /home/jude/code/alda && git add app/components/home/HomeHero.vue
git commit -m "feat(home): add HomeHero split-layout component with kente texture and parallax"
```

---

## Task 4: Create `HomeTrustBanner` Component

**Files:**
- Create: `app/components/home/HomeTrustBanner.vue`

Horizontal strip with 4 trust indicators using Lucide icons.

- [ ] **Step 1: Create the component**

```vue
<!-- app/components/home/HomeTrustBanner.vue -->
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
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /home/jude/code/alda/app && npx nuxi typecheck`

Expected: No type errors

- [ ] **Step 3: Commit**

```bash
cd /home/jude/code/alda && git add app/components/home/HomeTrustBanner.vue
git commit -m "feat(home): add HomeTrustBanner trust indicators strip"
```

---

## Task 5: Create `HomeTimeline` Component

**Files:**
- Create: `app/components/home/HomeTimeline.vue`

4-step visual timeline with Lucide icons, gradient connectors, and scroll-triggered entrance animations.

- [ ] **Step 1: Create the component**

```vue
<!-- app/components/home/HomeTimeline.vue -->
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
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /home/jude/code/alda/app && npx nuxi typecheck`

Expected: No type errors

- [ ] **Step 3: Commit**

```bash
cd /home/jude/code/alda && git add app/components/home/HomeTimeline.vue
git commit -m "feat(home): add HomeTimeline visual timeline with scroll-triggered animation"
```

---

## Task 6: Create `HomeDeclarers` Component

**Files:**
- Create: `app/components/home/HomeDeclarers.vue`

Tabbed "Who Must Declare" explorer using shadcn-vue Tabs with "line" variant.

- [ ] **Step 1: Create the component**

```vue
<!-- app/components/home/HomeDeclarers.vue -->
<script setup lang="ts">
import {
  Landmark,
  Scroll,
  Scale,
  Building2,
  ShieldCheck,
  Users,
  User,
  Briefcase,
  GraduationCap,
  Gavel,
  Swords,
  Globe,
  BookOpen,
  Building,
} from 'lucide-vue-next'
import type { Component } from 'vue'

interface RoleEntry {
  icon: Component
  title: string
}

interface BranchTab {
  id: string
  label: string
  icon: Component
  roles: RoleEntry[]
}

const branches: BranchTab[] = [
  {
    id: 'executive',
    label: 'Executive',
    icon: Landmark,
    roles: [
      { icon: User, title: 'President and Vice President' },
      { icon: Briefcase, title: 'Ministers and Deputy Ministers' },
      { icon: Users, title: 'Secretary to Cabinet' },
      { icon: Building, title: 'Heads of Ministries' },
    ],
  },
  {
    id: 'legislative',
    label: 'Legislative',
    icon: Scroll,
    roles: [
      { icon: User, title: 'Speaker and Deputy Speakers' },
      { icon: Users, title: 'Members of Parliament' },
      { icon: Briefcase, title: 'Parliamentary Staff (senior)' },
    ],
  },
  {
    id: 'judicial',
    label: 'Judicial',
    icon: Scale,
    roles: [
      { icon: Gavel, title: 'Chief Justice' },
      { icon: Scale, title: 'Justices of Superior Courts' },
      { icon: User, title: 'Regional Tribunal Chairmen' },
    ],
  },
  {
    id: 'public-enterprises',
    label: 'Public Enterprises',
    icon: Building2,
    roles: [
      { icon: Users, title: 'Board Chairmen and Members' },
      { icon: Briefcase, title: 'Managing Directors' },
      { icon: User, title: 'Deputy Managing Directors' },
    ],
  },
  {
    id: 'security',
    label: 'Security',
    icon: ShieldCheck,
    roles: [
      { icon: Swords, title: 'Police Service Officers' },
      { icon: ShieldCheck, title: 'Armed Forces Officers' },
      { icon: User, title: 'Immigration & Prisons Officers' },
    ],
  },
  {
    id: 'others',
    label: 'Others',
    icon: Globe,
    roles: [
      { icon: Globe, title: 'Ambassadors & High Commissioners' },
      { icon: GraduationCap, title: 'Heads of Educational Institutions' },
      { icon: BookOpen, title: 'Members of Regulatory Bodies' },
    ],
  },
]
</script>

<template>
  <section class="py-20">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-12">
        <h2 class="text-3xl font-bold text-foreground mb-4">
          Who Must Declare?
        </h2>
        <p class="text-muted-foreground max-w-2xl mx-auto">
          Under Article 286(5) of the 1992 Constitution, the following public
          officials are required to declare their assets
        </p>
      </div>

      <Tabs default-value="executive">
        <TabsList variant="line" class="w-full justify-start overflow-x-auto">
          <TabsTrigger
            v-for="branch in branches"
            :key="branch.id"
            :value="branch.id"
            class="gap-1.5"
          >
            <component :is="branch.icon" class="size-4" />
            <span class="hidden sm:inline">{{ branch.label }}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent
          v-for="branch in branches"
          :key="branch.id"
          :value="branch.id"
          class="mt-6"
        >
          <div class="grid sm:grid-cols-2 gap-3">
            <div
              v-for="role in branch.roles"
              :key="role.title"
              class="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/10"
            >
              <div
                class="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"
              >
                <component :is="role.icon" class="size-4 text-primary" />
              </div>
              <span class="font-medium text-sm text-foreground">
                {{ role.title }}
              </span>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  </section>
</template>
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /home/jude/code/alda/app && npx nuxi typecheck`

Expected: No type errors

- [ ] **Step 3: Commit**

```bash
cd /home/jude/code/alda && git add app/components/home/HomeDeclarers.vue
git commit -m "feat(home): add HomeDeclarers tabbed explorer for 'Who Must Declare'"
```

---

## Task 7: Create `HomeFaq` Component

**Files:**
- Create: `app/components/home/HomeFaq.vue`

FAQ accordion using shadcn-vue Accordion.

- [ ] **Step 1: Create the component**

```vue
<!-- app/components/home/HomeFaq.vue -->
<script setup lang="ts">
const faqs = [
  {
    question: 'What documents do I need to register?',
    answer:
      "You'll need your Ghana Card (front and back images), a valid email address, and a phone number. During registration, you'll upload photos of your Ghana Card for identity verification.",
  },
  {
    question: 'How long does the declaration process take?',
    answer:
      'The timeline varies by review workload. The portal tracks the status of your declaration at each stage, so you always know exactly where it stands — from submission through review to final receipt.',
  },
  {
    question: 'What happens after I submit my declaration?',
    answer:
      'Your declaration enters the review pipeline. A Schedule Officer processes the submission, then the Legal Unit verifies authenticity. Once approved and sealed, you receive an official receipt.',
  },
  {
    question: 'What if I lose my declaration form?',
    answer:
      'You can request a form reissue through the portal. The process requires offline approval from the Auditor General or a Regional Auditor. Once approved, a Legal Unit officer records the decision and reissues your form.',
  },
  {
    question: 'Is my declaration information confidential?',
    answer:
      'Yes. All declaration data is handled in accordance with constitutional requirements and data protection standards. Access is strictly limited to authorized officers, and all actions are logged in a tamper-proof audit trail.',
  },
]
</script>

<template>
  <section class="py-20 bg-muted/50">
    <div class="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-12">
        <h2 class="text-3xl font-bold text-foreground mb-4">
          Frequently Asked Questions
        </h2>
        <p class="text-muted-foreground">
          Everything you need to know about the declaration process
        </p>
      </div>

      <Accordion type="single" collapsible class="space-y-3">
        <AccordionItem
          v-for="(faq, index) in faqs"
          :key="index"
          :value="`faq-${index}`"
          class="bg-card rounded-xl border px-5"
        >
          <AccordionTrigger class="text-left font-semibold text-sm">
            {{ faq.question }}
          </AccordionTrigger>
          <AccordionContent class="text-sm text-muted-foreground leading-relaxed">
            {{ faq.answer }}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  </section>
</template>
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /home/jude/code/alda/app && npx nuxi typecheck`

Expected: No type errors

- [ ] **Step 3: Commit**

```bash
cd /home/jude/code/alda && git add app/components/home/HomeFaq.vue
git commit -m "feat(home): add HomeFaq accordion section"
```

---

## Task 8: Create `HomeFooter` Component

**Files:**
- Create: `app/components/home/HomeFooter.vue`

4-column footer with Ghana tricolor accent bar.

- [ ] **Step 1: Create the component**

```vue
<!-- app/components/home/HomeFooter.vue -->
<script setup lang="ts">
import { Mail, Phone, MapPin } from 'lucide-vue-next'
</script>

<template>
  <footer class="bg-foreground text-background">
    <!-- Ghana tricolor accent -->
    <div
      class="h-[3px]"
      style="background: linear-gradient(to right, #006B3F, #FCD116, #CE1126)"
    />

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
        <!-- Organization -->
        <div class="lg:col-span-1">
          <div class="flex items-center gap-3 mb-4">
            <div
              class="w-9 h-9 rounded-full bg-primary flex items-center justify-center"
            >
              <span class="text-primary-foreground font-bold text-sm">GH</span>
            </div>
            <div>
              <div class="font-semibold text-sm">Asset Declaration Portal</div>
              <div class="text-xs opacity-60">Ghana Audit Service</div>
            </div>
          </div>
          <p class="text-sm opacity-60 leading-relaxed">
            Ensuring transparency and accountability in public service through
            constitutional compliance.
          </p>
        </div>

        <!-- Quick Links -->
        <div>
          <h3
            class="text-xs font-semibold uppercase tracking-wider opacity-50 mb-4"
          >
            Quick Links
          </h3>
          <ul class="space-y-2 text-sm">
            <li>
              <NuxtLink
                to="/auth/register"
                class="opacity-70 hover:opacity-100 transition-opacity"
              >
                Start Declaration
              </NuxtLink>
            </li>
            <li>
              <a
                href="#how-it-works"
                class="opacity-70 hover:opacity-100 transition-opacity"
              >
                How It Works
              </a>
            </li>
            <li>
              <a
                href="#who-must-declare"
                class="opacity-70 hover:opacity-100 transition-opacity"
              >
                Who Must Declare
              </a>
            </li>
            <li>
              <a
                href="#faq"
                class="opacity-70 hover:opacity-100 transition-opacity"
              >
                FAQ
              </a>
            </li>
          </ul>
        </div>

        <!-- Legal -->
        <div>
          <h3
            class="text-xs font-semibold uppercase tracking-wider opacity-50 mb-4"
          >
            Legal
          </h3>
          <ul class="space-y-2 text-sm">
            <li>
              <NuxtLink
                to="/privacy"
                class="opacity-70 hover:opacity-100 transition-opacity"
              >
                Privacy Policy
              </NuxtLink>
            </li>
            <li>
              <NuxtLink
                to="/terms"
                class="opacity-70 hover:opacity-100 transition-opacity"
              >
                Terms of Service
              </NuxtLink>
            </li>
            <li>
              <NuxtLink
                to="/contact"
                class="opacity-70 hover:opacity-100 transition-opacity"
              >
                Contact Us
              </NuxtLink>
            </li>
          </ul>
        </div>

        <!-- Contact -->
        <div>
          <h3
            class="text-xs font-semibold uppercase tracking-wider opacity-50 mb-4"
          >
            Contact
          </h3>
          <ul class="space-y-3 text-sm">
            <li class="flex items-center gap-2 opacity-70">
              <Mail class="size-4 shrink-0" />
              <span>info@ghaudit.org</span>
            </li>
            <li class="flex items-center gap-2 opacity-70">
              <Phone class="size-4 shrink-0" />
              <span>+233 302 664 920</span>
            </li>
            <li class="flex items-center gap-2 opacity-70">
              <MapPin class="size-4 shrink-0" />
              <span>Accra, Ghana</span>
            </li>
            <li>
              <NuxtLink
                to="/contact"
                class="opacity-70 hover:opacity-100 transition-opacity"
              >
                Contact Form →
              </NuxtLink>
            </li>
          </ul>
        </div>
      </div>

      <!-- Bottom bar -->
      <div
        class="border-t border-background/10 mt-10 pt-6 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs opacity-50"
      >
        <span>© {{ new Date().getFullYear() }} Ghana Audit Service. All rights reserved.</span>
        <span>Republic of Ghana</span>
      </div>
    </div>
  </footer>
</template>
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /home/jude/code/alda/app && npx nuxi typecheck`

Expected: No type errors

- [ ] **Step 3: Commit**

```bash
cd /home/jude/code/alda && git add app/components/home/HomeFooter.vue
git commit -m "feat(home): add HomeFooter with 4-column layout and Ghana tricolor accent"
```

---

## Task 9: Rewrite `index.vue` to Orchestrate All Sections

**Files:**
- Modify: `app/pages/index.vue`

Replace the entire file with a clean composition of all section components.

- [ ] **Step 1: Rewrite index.vue**

```vue
<!-- app/pages/index.vue -->
<template>
  <div class="min-h-screen">
    <HomeHero />
    <HomeTrustBanner />
    <HomeTimeline />
    <HomeDeclarers />
    <HomeFaq />
    <HomeFooter />
  </div>
</template>
```

- [ ] **Step 2: Typecheck the full app**

Run: `cd /home/jude/code/alda/app && npx nuxi typecheck`

Expected: No type errors

- [ ] **Step 3: Commit**

```bash
cd /home/jude/code/alda && git add app/pages/index.vue
git commit -m "feat(home): rewrite index.vue to compose all new section components"
```

---

## Task 10: Visual Testing Across All 6 Themes

**Files:** None (testing only)

Open the dev server and manually verify the home page in each theme.

- [ ] **Step 1: Start dev server**

Run: `cd /home/jude/code/alda/app && npm run dev`

Open `http://localhost:3000` in a browser.

- [ ] **Step 2: Test each theme**

For each of the 6 themes (Light, Dark, High Contrast, Sepia, Solarized, System), use the theme switcher and verify:

1. **Hero section**: Kente pattern visible at low opacity, CTAs have sufficient contrast (yellow button readable, Learn More border visible), emblem decorative elements visible
2. **Trust banner**: Icons visible, text readable, background distinguishable from adjacent sections
3. **Timeline**: Step icons have clear contrast, connectors visible, animation plays on scroll
4. **Declarers tabs**: Active tab clearly indicated, role cards have distinct backgrounds, tab bar scrollable on narrow viewports
5. **FAQ accordion**: Cards visually distinct from background, chevron animates, open/close works
6. **Footer**: Tricolor bar always shows Ghana colors (green/yellow/red), text readable against dark background, links functional

- [ ] **Step 3: Test mobile responsiveness**

Resize to 375px width and verify:
- Hero: right emblem hidden, text centered, CTAs stack if needed
- Trust banner: single column
- Timeline: vertical layout with left-side line
- Tabs: horizontal scroll on tab bar
- Footer: single column

- [ ] **Step 4: Test reduced motion**

In browser DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion: reduce". Verify:
- Timeline steps appear immediately without animation
- Hero parallax disabled
- Scroll indicator does not bounce

- [ ] **Step 5: Fix any issues found**

Apply targeted fixes to the affected component files. Each fix gets its own commit.

- [ ] **Step 6: Final commit**

```bash
cd /home/jude/code/alda && git add -A
git commit -m "fix(home): address visual issues found during theme testing"
```

---

## Task 11: Add Section IDs for In-Page Navigation

**Files:**
- Modify: `app/components/home/HomeDeclarers.vue`
- Modify: `app/components/home/HomeFaq.vue`

The footer's Quick Links reference `#who-must-declare` and `#faq`. Add matching IDs to those sections.

- [ ] **Step 1: Add id to HomeDeclarers**

In `app/components/home/HomeDeclarers.vue`, change the opening `<section>` tag:

```html
<section id="who-must-declare" class="py-20">
```

- [ ] **Step 2: Add id to HomeFaq**

In `app/components/home/HomeFaq.vue`, change the opening `<section>` tag:

```html
<section id="faq" class="py-20 bg-muted/50">
```

- [ ] **Step 3: Verify anchor links work**

Open `http://localhost:3000`, click "FAQ" in the footer. Page should smooth-scroll to the FAQ section. Same for "Who Must Declare" and "How It Works".

- [ ] **Step 4: Commit**

```bash
cd /home/jude/code/alda && git add app/components/home/HomeDeclarers.vue app/components/home/HomeFaq.vue
git commit -m "feat(home): add section IDs for in-page anchor navigation"
```
