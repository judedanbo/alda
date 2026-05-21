<script setup lang="ts">
import type { ChartsData } from "~/composables/useAnalytics";

const props = defineProps<{
  data: ChartsData["timeline"] | undefined;
  loading: boolean;
}>();

const series = computed(() => {
  if (!props.data) return [];
  return [
    { name: "Current Period", data: props.data.map((d) => d.count) },
    { name: "Previous Period", data: props.data.map((d) => d.prevCount) },
  ];
});

const options = computed(() => ({
  xaxis: {
    categories: props.data?.map((d) => d.month) ?? [],
  },
}));
</script>

<template>
  <AppChartCard
    title="Sealed Declarations Over Time"
    description="Monthly sealed count with previous period comparison"
    type="area"
    :series="series"
    :options="options"
    :loading="loading"
    :height="280"
  />
</template>
