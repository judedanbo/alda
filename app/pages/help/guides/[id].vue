<script setup lang="ts">
import { ArrowLeftIcon, ClockIcon, PlayIcon } from "lucide-vue-next";
import { getGuideById, appliesToRole } from "~/help";
import { useAuthStore } from "~/stores/auth";

definePageMeta({
  layout: "dashboard",
});

const route = useRoute();
const authStore = useAuthStore();
const { currentRole } = useHelp();

if (!authStore.isAuthenticated) {
  setPageLayout("auth");
}

const guide = computed(() => {
  const found = getGuideById(route.params.id as string);
  if (!found) return undefined;
  if (authStore.isAdmin) return found;
  return appliesToRole(found.roles, currentRole.value) ? found : undefined;
});

const { start } = useTour();

useSeoMeta({
  title: () =>
    guide.value
      ? `${guide.value.title} - Help`
      : "Help - Asset Declaration Portal",
});
</script>

<template>
  <div>
    <NuxtLink
      to="/help?tab=guides"
      class="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm"
    >
      <ArrowLeftIcon class="size-4" />
      Back to Help Centre
    </NuxtLink>

    <!-- Not found -->
    <Card v-if="!guide" class="py-12 text-center">
      <CardContent>
        <h2 class="text-foreground text-lg font-medium">Guide not found</h2>
        <p class="text-muted-foreground mt-1 text-sm">
          This guide does not exist or has been moved.
        </p>
        <Button as-child class="mt-4">
          <NuxtLink to="/help">Open Help Centre</NuxtLink>
        </Button>
      </CardContent>
    </Card>

    <Card v-else>
      <CardHeader>
        <p
          class="text-primary text-[11px] font-semibold uppercase tracking-wide"
        >
          Guide
        </p>
        <CardTitle class="text-2xl">{{ guide.title }}</CardTitle>
        <CardDescription>{{ guide.description }}</CardDescription>
        <div class="flex flex-wrap items-center gap-3 pt-1">
          <Badge variant="outline">{{ guide.steps.length }} steps</Badge>
          <span
            v-if="guide.estimatedMinutes"
            class="text-muted-foreground flex items-center gap-1 text-xs"
          >
            <ClockIcon class="size-3.5" />
            About {{ guide.estimatedMinutes }} min
          </span>
        </div>
      </CardHeader>
      <CardContent class="space-y-6">
        <!-- Prefer a hands-on walkthrough? Launch the matching tour. -->
        <div
          v-if="guide.relatedTourId"
          class="border-primary/20 bg-primary/5 flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div class="min-w-0">
            <p class="text-foreground text-sm font-medium">
              Prefer a hands-on walkthrough?
            </p>
            <p class="text-muted-foreground text-sm">
              Run this guide as an interactive tour right on the page.
            </p>
          </div>
          <Button class="shrink-0" @click="start(guide.relatedTourId)">
            <PlayIcon class="size-4" />
            Start interactive tour
          </Button>
        </div>

        <HelpGuideSteps :steps="guide.steps" />
      </CardContent>
    </Card>
  </div>
</template>
