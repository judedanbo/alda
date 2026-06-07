<script setup lang="ts">
import { CircleHelpIcon } from "lucide-vue-next";
import { useHelpStore } from "~/stores/help";

const helpStore = useHelpStore();
</script>

<template>
  <div class="min-h-screen flex flex-col bg-muted/30">
    <!-- Branded top band: official Ghana Audit Service identity -->
    <header class="relative overflow-hidden bg-primary text-white">
      <HomeKentePattern :opacity="0.05" />

      <div
        class="relative z-10 max-w-6xl mx-auto px-4 py-6 flex items-center justify-between gap-4"
      >
        <AppBrandLogo
          to="/"
          size="md"
          show-wordmark
          chip
          wordmark-class="text-white"
          subtitle-class="text-white/80"
        />
        <div class="flex items-center gap-2">
          <button
            type="button"
            data-tour="help-button"
            aria-label="Help for this page"
            class="flex items-center justify-center w-9 h-9 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            @click="helpStore.openContextual()"
          >
            <CircleHelpIcon class="w-5 h-5" />
          </button>
          <AppThemeSwitcherButton />
        </div>
      </div>

      <!-- Ghana tricolor accent -->
      <div
        class="h-[3px]"
        style="background: linear-gradient(to right, #006b3f, #fcd116, #ce1126)"
      />
    </header>

    <!-- Main content sits on a clean, readable surface (not over the pattern),
         so both short auth cards and long-form legal pages stay legible. -->
    <main
      id="main-content"
      tabindex="-1"
      class="relative flex-1 flex items-center justify-center p-4 sm:p-6"
    >
      <!-- faint depth fading down from the branded band (token-based, theme-safe) -->
      <div
        class="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent"
        aria-hidden="true"
      />
      <div class="relative w-full flex justify-center">
        <slot />
      </div>
    </main>

    <!-- Footer -->
    <footer class="bg-muted text-foreground">
      <div
        class="h-[3px]"
        style="background: linear-gradient(to right, #006b3f, #fcd116, #ce1126)"
      />
      <div class="py-5 px-4 text-center">
        <p class="text-sm text-muted-foreground">
          &copy; {{ new Date().getFullYear() }} Ghana Audit Service. All rights
          reserved.
        </p>
        <p class="text-xs text-muted-foreground mt-1">
          Article 286(5) — Asset Declaration System
        </p>
        <div class="mt-2 flex items-center justify-center gap-4 text-xs">
          <NuxtLink
            to="/terms"
            class="text-muted-foreground hover:text-primary hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            Terms of Service
          </NuxtLink>
          <span class="text-muted-foreground" aria-hidden="true">|</span>
          <NuxtLink
            to="/privacy"
            class="text-muted-foreground hover:text-primary hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            Privacy Policy
          </NuxtLink>
          <span class="text-muted-foreground" aria-hidden="true">|</span>
          <NuxtLink
            to="/accessibility"
            class="text-muted-foreground hover:text-primary hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            Accessibility
          </NuxtLink>
        </div>
      </div>
    </footer>

    <HelpSheet />
  </div>
</template>
