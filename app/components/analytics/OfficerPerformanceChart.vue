<script setup lang="ts">
import type { ChartsData } from "~/composables/useAnalytics";

const props = defineProps<{
  data: ChartsData["officerPerformance"] | undefined;
  loading: boolean;
}>();

const series = computed(() => {
  if (!props.data) return [];
  return [
    { name: "Declarations Processed", type: "column", data: props.data.map((d) => d.count) },
    { name: "Avg Days", type: "line", data: props.data.map((d) => d.avgDays) },
  ];
});

const options = computed(() => ({
  chart: { type: "line" as const },
  plotOptions: { bar: { columnWidth: "45%" } },
  stroke: { width: [0, 3] },
  xaxis: {
    categories: props.data?.map((d) => d.name) ?? [],
  },
  yaxis: [
    { title: { text: "Count" } },
    { opposite: true, title: { text: "Avg Days" } },
  ],
}));
</script>

<template>
  <AppChartCard
    title="Officer Performance"
    description="Top 10 officers by declarations processed and avg processing time"
    type="line"
    :series="series"
    :options="options"
    :loading="loading"
    :height="280"
  />
</template>
