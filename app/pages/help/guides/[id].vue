<script setup lang="ts">
import { ArrowLeftIcon, ClockIcon, PlayIcon } from "lucide-vue-next";
import { getGuideById } from "~/help";

definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const route = useRoute();
const guide = computed(() => getGuideById(route.params.id as string));

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
        <Button
          v-if="guide.relatedTourId"
          variant="outline"
          @click="start(guide.relatedTourId)"
        >
          <PlayIcon class="size-4" />
          Start interactive tour
        </Button>

        <HelpGuideSteps :steps="guide.steps" />
      </CardContent>
    </Card>
  </div>
</template>
