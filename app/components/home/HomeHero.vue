<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { usePreferredReducedMotion } from "@vueuse/core";
import { Mouse, ShieldCheck } from "lucide-vue-next";

const prefersReducedMotion = usePreferredReducedMotion();
const scrollY = ref(0);

function onScroll() {
  scrollY.value = window.scrollY;
}

onMounted(() => {
  if (prefersReducedMotion.value !== "reduce") {
    window.addEventListener("scroll", onScroll, { passive: true });
  }
});

onUnmounted(() => {
  window.removeEventListener("scroll", onScroll);
});
</script>

<template>
  <section class="relative overflow-hidden bg-primary text-white">
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
        <AppBrandLogo
          to="/"
          size="sm"
          show-wordmark
          chip
          wordmark-class="hidden sm:block text-white"
          subtitle-class="hidden sm:block text-white/80"
        />
        <div class="flex items-center gap-2">
          <AppThemeSwitcherButton />
          <Button
            variant="link"
            as-child
            class="text-white hover:text-white/80"
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
            class="inline-block rounded-full border border-secondary/30 bg-secondary/15 px-4 py-1 text-xs font-medium tracking-wide text-secondary mb-6"
          >
            REPUBLIC OF GHANA
          </span>
          <h2
            class="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 leading-tight"
          >
            Asset Declaration<br >System
          </h2>
          <p
            class="flex items-center justify-center md:justify-start gap-2 text-secondary font-medium mb-6"
          >
            <ShieldCheck class="size-5 shrink-0" aria-hidden="true" />
            An official portal of the Ghana Audit Service
          </p>
          <p
            class="text-lg text-white/75 max-w-lg mb-8 leading-relaxed mx-auto md:mx-0"
          >
            Online portal for public office holders to submit their asset
            declarations as required by Article 286(5) of the 1992 Constitution
            and the Public Office Holders (Declaration of Assets and
            Disqualification) Act, 1998 (Act 550).
          </p>
          <div class="flex items-center gap-4 justify-center md:justify-start">
            <Button
              size="lg"
              variant="secondary"
              as-child
              class="font-semibold"
            >
              <NuxtLink to="/auth/register">Start Declaration</NuxtLink>
            </Button>
            <Button
              size="lg"
              variant="outline"
              as-child
              class="border-white/50 bg-transparent text-white hover:bg-white/10 hover:text-white dark:bg-transparent dark:border-white/50 dark:hover:bg-white/10"
            >
              <a href="#how-it-works">Learn More ↓</a>
            </Button>
          </div>
        </div>

        <!-- Right: official seal (hidden on mobile) -->
        <div
          class="hidden md:flex flex-[0.8] items-center justify-center relative"
          :style="{
            transform:
              prefersReducedMotion !== 'reduce'
                ? `translateY(${scrollY * -0.1}px)`
                : undefined,
          }"
        >
          <img
            src="/gas-logo.png"
            alt="Ghana Audit Service official seal"
            width="360"
            height="360"
            class="w-60 h-60 lg:w-80 lg:h-80 object-contain drop-shadow-xl"
            decoding="async"
          >
          <!-- Floating dots -->
          <div
            class="absolute top-8 right-8 w-2 h-2 rounded-full bg-secondary/30"
          />
          <div
            class="absolute bottom-16 right-12 w-1.5 h-1.5 rounded-full bg-accent/30"
          />
          <div
            class="absolute top-20 left-4 w-1.5 h-1.5 rounded-full bg-white/20"
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
