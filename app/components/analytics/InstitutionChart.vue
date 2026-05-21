<script setup lang="ts">
import type { ChartsData } from "~/composables/useAnalytics";

const props = defineProps<{
  data: ChartsData["byInstitution"] | undefined;
  loading: boolean;
}>();

const series = computed(() => {
  if (!props.data) return [];
  return [{ name: "Declarations", data: props.data.map((d) => d.count) }];
});

const options = computed(() => ({
  plotOptions: { bar: { horizontal: true, barHeight: "60%" } },
  xaxis: {
    categories: props.data?.map((d) =>
      d.name.length > 25 ? d.name.slice(0, 22) + "…" : d.name,
    ) ?? [],
  },
}));
</script>

<template>
  <AppChartCard
    title="By Institution / Office"
    description="Top 10 institutions by sealed declarations"
    type="bar"
    :series="series"
    :options="options"
    :loading="loading"
    :height="280"
  />
</template>
