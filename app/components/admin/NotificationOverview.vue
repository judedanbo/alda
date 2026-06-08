<script setup lang="ts">
import { Card, CardContent } from "~/components/ui/card";
import { Alert, AlertDescription } from "~/components/ui/alert";

interface Kpi {
  total: number;
  delivered: number;
  failed: number;
  pending: number;
  deliveryRate: number | null;
}
interface Stats {
  kpis: { last24h: Kpi; last14d: Kpi };
  byChannel: { channel: string; total: number; delivered: number; failed: number; pending: number }[];
  failuresByType: { type: string; failed: number }[];
  trend: { date: string; delivered: number; failed: number }[];
}

const stats = ref<Stats | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const res = await authFetch<{ success: boolean; data: Stats }>("/api/admin/notifications/stats");
    stats.value = res.data;
  } catch (err: unknown) {
    const e = err as { data?: { message?: string; statusMessage?: string } };
    error.value = e.data?.message || e.data?.statusMessage || "Failed to load metrics";
  } finally {
    loading.value = false;
  }
}
onMounted(load);
defineExpose({ refresh: load });

const fmtRate = (r: number | null) => (r === null ? "—" : `${r}%`);

// 14-day delivered-vs-failed trend (area).
const trendSeries = computed(() => [
  { name: "Delivered", data: stats.value?.trend.map((d) => d.delivered) ?? [] },
  { name: "Failed", data: stats.value?.trend.map((d) => d.failed) ?? [] },
]);
const trendOptions = computed(() => ({
  xaxis: { categories: stats.value?.trend.map((d) => d.date) ?? [] },
  colors: ["#16a34a", "#dc2626"],
}));

// Per-channel breakdown (stacked bar).
const channelSeries = computed(() => [
  { name: "Delivered", data: stats.value?.byChannel.map((c) => c.delivered) ?? [] },
  { name: "Failed", data: stats.value?.byChannel.map((c) => c.failed) ?? [] },
  { name: "Pending", data: stats.value?.byChannel.map((c) => c.pending) ?? [] },
]);
const channelOptions = computed(() => ({
  chart: { stacked: true },
  xaxis: { categories: stats.value?.byChannel.map((c) => c.channel) ?? [] },
  colors: ["#16a34a", "#dc2626", "#f59e0b"],
  plotOptions: { bar: { horizontal: false, columnWidth: "45%" } },
}));

const hasFailureTypes = computed(() => (stats.value?.failuresByType.length ?? 0) > 0);
const failureSeries = computed(() => [
  { name: "Failed", data: stats.value?.failuresByType.map((f) => f.failed) ?? [] },
]);
const failureOptions = computed(() => ({
  // chart type is set via the AppChartCard `type` prop
  xaxis: { categories: stats.value?.failuresByType.map((f) => f.type) ?? [] },
  colors: ["#dc2626"],
  plotOptions: { bar: { horizontal: true } },
}));
</script>

<template>
  <div class="space-y-6">
    <Alert v-if="error" variant="destructive">
      <AlertDescription>{{ error }}</AlertDescription>
    </Alert>

    <!-- KPI cards: last 24h headline, last 14d as context -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardContent class="pt-6">
          <p class="text-xs text-muted-foreground">Delivery rate (24h)</p>
          <p class="text-2xl font-semibold text-foreground">{{ fmtRate(stats?.kpis.last24h.deliveryRate ?? null) }}</p>
          <p class="text-xs text-muted-foreground mt-1">14d: {{ fmtRate(stats?.kpis.last14d.deliveryRate ?? null) }}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent class="pt-6">
          <p class="text-xs text-muted-foreground">Delivered (24h)</p>
          <p class="text-2xl font-semibold text-green-600">{{ stats?.kpis.last24h.delivered ?? 0 }}</p>
          <p class="text-xs text-muted-foreground mt-1">14d: {{ stats?.kpis.last14d.delivered ?? 0 }}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent class="pt-6">
          <p class="text-xs text-muted-foreground">Failed (24h)</p>
          <p class="text-2xl font-semibold text-red-600">{{ stats?.kpis.last24h.failed ?? 0 }}</p>
          <p class="text-xs text-muted-foreground mt-1">14d: {{ stats?.kpis.last14d.failed ?? 0 }}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent class="pt-6">
          <p class="text-xs text-muted-foreground">Pending (24h)</p>
          <p class="text-2xl font-semibold text-amber-600">{{ stats?.kpis.last24h.pending ?? 0 }}</p>
          <p class="text-xs text-muted-foreground mt-1">14d: {{ stats?.kpis.last14d.pending ?? 0 }}</p>
        </CardContent>
      </Card>
    </div>

    <p class="text-xs text-muted-foreground">
      Delivery rate = delivered ÷ (delivered + failed). Note: email
      <span class="font-medium">Delivered</span> means accepted by the mail server (no bounce
      tracking); SMS <span class="font-medium">Delivered</span> can be carrier-confirmed via the
      provider webhook.
    </p>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <AppChartCard
        title="Delivered vs failed (14 days)"
        description="Daily delivery outcomes"
        type="area"
        :series="trendSeries"
        :options="trendOptions"
        :loading="loading"
        :height="280"
      />
      <AppChartCard
        title="By channel (14 days)"
        description="Outcomes per delivery channel"
        type="bar"
        :series="channelSeries"
        :options="channelOptions"
        :loading="loading"
        :height="280"
      />
    </div>

    <AppChartCard
      v-if="hasFailureTypes"
      title="Top failing notification types (14 days)"
      description="Where failures are concentrated"
      type="bar"
      :series="failureSeries"
      :options="failureOptions"
      :loading="loading"
      :height="260"
    />
  </div>
</template>
