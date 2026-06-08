<script setup lang="ts">
import {
  ArrowLeftIcon,
  HouseIcon,
  LifeBuoyIcon,
  MapPinOffIcon,
  RotateCwIcon,
  ServerCrashIcon,
  ShieldXIcon,
  TriangleAlertIcon,
} from "lucide-vue-next";
import type { Component } from "vue";
import type { NuxtError } from "#app";

// error.vue replaces the entire app when an error is rendered, so it can't use
// <NuxtLayout>/<NuxtPage>. The branded chrome below is built inline, mirroring
// app/layouts/auth.vue so the error screen stays on-brand.
const props = defineProps<{ error: NuxtError }>();

const router = useRouter();
const route = useRoute();

const statusCode = computed(() => props.error?.statusCode ?? 500);

// Per-status presentation. The fallback covers 401/503 and anything unmapped;
// it surfaces the status message when one is present so it stays informative.
const content = computed(() => {
  const fallbackTitle = props.error?.statusMessage?.trim() || "Something went wrong";
  const map: Record<number, { icon: Component; title: string; description: string }> = {
    404: {
      icon: MapPinOffIcon,
      title: "Page not found",
      description:
        "The page you're looking for doesn't exist or may have moved.",
    },
    403: {
      icon: ShieldXIcon,
      title: "Access denied",
      description:
        "You don't have permission to view this page. If you think this is a mistake, contact support.",
    },
    500: {
      icon: ServerCrashIcon,
      title: "Something went wrong",
      description:
        "An unexpected error occurred on our end. Please try again in a moment.",
    },
  };
  return (
    map[statusCode.value] ?? {
      icon: TriangleAlertIcon,
      title: fallbackTitle,
      description:
        "We hit an unexpected problem handling your request. Please try again, or head back to the homepage.",
    }
  );
});

// Server failures are worth retrying; not-found / forbidden are not.
const canRetry = computed(() => statusCode.value >= 500);

const isDev = import.meta.dev;

useHead({
  title: () => `${statusCode.value} — ${content.value.title} · Asset Declaration Portal`,
});

function goHome() {
  // clearError unmounts the error page and resumes normal app rendering.
  clearError({ redirect: "/" });
}

function goBack() {
  // history.state.back is null on a fresh load (e.g. a deep link that 404'd),
  // in which case there's nowhere to go back to — fall back to home.
  if (import.meta.client && window.history.state?.back) {
    router.back();
  } else {
    goHome();
  }
}

function retry() {
  // Re-navigate to the same route so the failed render is attempted again.
  clearError({ redirect: route.fullPath });
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-muted/30">
    <!-- Branded top band: official Ghana Audit Service identity -->
    <header class="relative overflow-hidden bg-primary text-white">
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
      </div>

      <!-- Ghana tricolor accent -->
      <div
        class="h-[3px]"
        style="background: linear-gradient(to right, #006b3f, #fcd116, #ce1126)"
      />
    </header>

    <main
      id="main-content"
      tabindex="-1"
      class="relative flex-1 flex items-center justify-center p-4 sm:p-6"
    >
      <div
        class="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent"
        aria-hidden="true"
      />

      <div class="relative w-full max-w-lg text-center">
        <component
          :is="content.icon"
          class="mx-auto size-14 text-primary"
          aria-hidden="true"
        />

        <p class="mt-6 text-5xl font-bold tracking-tight text-foreground">
          {{ statusCode }}
        </p>
        <h1 class="mt-2 text-2xl font-semibold text-foreground">
          {{ content.title }}
        </h1>
        <p class="mt-3 text-base text-muted-foreground">
          {{ content.description }}
        </p>

        <div class="mt-8 flex flex-col sm:flex-row sm:flex-wrap items-center justify-center gap-3">
          <Button class="w-full sm:w-auto" @click="goHome">
            <HouseIcon class="size-4" aria-hidden="true" />
            Go to homepage
          </Button>
          <Button variant="outline" class="w-full sm:w-auto" @click="goBack">
            <ArrowLeftIcon class="size-4" aria-hidden="true" />
            Go back
          </Button>
          <Button
            v-if="canRetry"
            variant="outline"
            class="w-full sm:w-auto"
            @click="retry"
          >
            <RotateCwIcon class="size-4" aria-hidden="true" />
            Try again
          </Button>
        </div>

        <p class="mt-6 text-sm text-muted-foreground">
          Still stuck?
          <NuxtLink
            to="/contact"
            class="inline-flex items-center gap-1 font-medium text-primary hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            <LifeBuoyIcon class="size-4" aria-hidden="true" />
            Contact support
          </NuxtLink>
        </p>

        <!-- Technical details: dev only, never exposed to end users in prod -->
        <details
          v-if="isDev"
          class="mt-8 text-left rounded-lg border border-border bg-card p-4"
        >
          <summary class="cursor-pointer text-sm font-medium text-foreground">
            Technical details (dev only)
          </summary>
          <dl class="mt-3 space-y-2 text-xs">
            <div v-if="error?.statusMessage">
              <dt class="font-semibold text-foreground">Status message</dt>
              <dd class="text-muted-foreground">{{ error.statusMessage }}</dd>
            </div>
            <div v-if="error?.message">
              <dt class="font-semibold text-foreground">Message</dt>
              <dd class="text-muted-foreground">{{ error.message }}</dd>
            </div>
            <div v-if="error?.stack">
              <dt class="font-semibold text-foreground">Stack</dt>
              <dd>
                <pre class="mt-1 overflow-auto whitespace-pre-wrap break-words rounded bg-muted p-2 text-muted-foreground">{{ error.stack }}</pre>
              </dd>
            </div>
          </dl>
        </details>
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
      </div>
    </footer>
  </div>
</template>
