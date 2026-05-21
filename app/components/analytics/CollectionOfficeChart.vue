<script setup lang="ts">
import type { ChartsData } from "~/composables/useAnalytics";

const props = defineProps<{
  data: ChartsData["byCollectionOffice"] | undefined;
  loading: boolean;
}>();

const { palette, gridColor, foreColor, tooltipTheme } = useChartTheme();

const donutSeries = computed(() =>
  props.data?.byType.map((d) => d.count) ?? [],
);

const donutOptions = computed(() => ({
  labels: props.data?.byType.map((d) => d.type) ?? [],
  legend: { position: "bottom" as const },
  colors: palette.value,
  chart: { background: "transparent", foreColor: foreColor.value },
  tooltip: { theme: tooltipTheme.value },
}));

const barSeries = computed(() => {
  if (!props.data?.byRegion.length) return [];
  return [{ name: "Declarations", data: props.data.byRegion.map((d) => d.count) }];
});

const barOptions = computed(() => ({
  plotOptions: { bar: { horizontal: false, columnWidth: "55%" } },
  xaxis: {
    categories: props.data?.byRegion.map((d) => d.region) ?? [],
    labels: { rotate: -45, style: { fontSize: "10px" } },
  },
  colors: palette.value,
  chart: { background: "transparent", foreColor: foreColor.value },
  grid: { borderColor: gridColor.value, strokeDashArray: 4 },
  tooltip: { theme: tooltipTheme.value },
}));
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">By Collection Office</CardTitle>
      <CardDescription>HQ vs Regional split and breakdown by region</CardDescription>
    </CardHeader>
    <CardContent>
      <Skeleton v-if="loading" class="w-full h-[280px]" />
      <div v-else class="grid grid-cols-2 gap-4">
        <ClientOnly>
          <apexchart
            type="donut"
            :series="donutSeries"
            :options="donutOptions"
            :height="240"
          />
          <template #fallback>
            <Skeleton class="w-full h-[240px]" />
          </template>
        </ClientOnly>
        <ClientOnly>
          <apexchart
            v-if="barSeries.length > 0"
            type="bar"
            :series="barSeries"
            :options="barOptions"
            :height="240"
          />
          <div v-else class="flex items-center justify-center h-[240px] text-muted-foreground text-sm">
            No regional data
          </div>
          <template #fallback>
            <Skeleton class="w-full h-[240px]" />
          </template>
        </ClientOnly>
      </div>
    </CardContent>
  </Card>
</template>
