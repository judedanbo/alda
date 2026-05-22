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
            Asset Declaration<br>System
          </h2>
          <p
            class="text-lg text-primary-foreground/75 max-w-lg mb-8 leading-relaxed mx-auto md:mx-0"
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
