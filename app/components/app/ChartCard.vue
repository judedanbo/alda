<script setup lang="ts">
import type { ApexOptions } from "apexcharts";

const ApexChart = defineAsyncComponent(() => import("vue3-apexcharts"));

interface Props {
  title: string;
  description?: string;
  type: "area" | "bar" | "line" | "donut" | "radialBar";
  series: ApexOptions["series"];
  options?: ApexOptions;
  height?: number | string;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  description: undefined,
  options: undefined,
  height: 300,
  loading: false,
});

const { palette, gridColor, foreColor, tooltipTheme } = useChartTheme();

const baseOptions = computed<ApexOptions>(() => ({
  chart: {
    fontFamily: "inherit",
    toolbar: { show: false },
    zoom: { enabled: false },
    background: "transparent",
    foreColor: foreColor.value,
  },
  colors: palette.value,
  grid: {
    borderColor: gridColor.value,
    strokeDashArray: 4,
  },
  dataLabels: { enabled: false },
  legend: {
    position: "bottom",
    fontSize: "12px",
  },
  stroke: {
    curve: "smooth",
    width: props.type === "area" || props.type === "line" ? 2 : 0,
  },
  fill:
    props.type === "area"
      ? {
        type: "gradient",
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.45,
          opacityTo: 0.05,
          stops: [0, 90, 100],
        },
      }
      : { opacity: 1 },
  tooltip: {
    theme: tooltipTheme.value,
    style: { fontSize: "12px" },
  },
  xaxis: {
    labels: { style: { fontSize: "11px" } },
    axisBorder: { show: false },
    axisTicks: { show: false },
  },
  yaxis: {
    labels: { style: { fontSize: "11px" } },
  },
  ...(props.options ?? {}),
}));
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">{{ title }}</CardTitle>
      <CardDescription v-if="description">{{ description }}</CardDescription>
    </CardHeader>
    <CardContent>
      <Skeleton v-if="loading" class="w-full" :style="{ height: `${height}px` }" />
      <ClientOnly v-else>
        <ApexChart
          :type="type"
          :series="series"
          :options="baseOptions"
          :height="height"
        />
        <template #fallback>
          <Skeleton class="w-full" :style="{ height: `${height}px` }" />
        </template>
      </ClientOnly>
    </CardContent>
  </Card>
</template>
