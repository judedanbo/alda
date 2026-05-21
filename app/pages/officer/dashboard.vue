<script setup lang="ts">
definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

interface OfficerDashboardData {
  queues: {
    pendingFormCollections: number;
    pendingFormReturns: number;
    pendingReviews: number;
    underReview: number;
    pendingReceipts: number;
    withReviewComments: number;
  };
  codeWindows: { today: number; week: number; month: number };
  funnel: { status: string; count: number }[];
  throughput: { date: string; codes: number; receipts: number }[];
}

const { data: dashboard, loading } = useDashboardStats<OfficerDashboardData>("/api/officer/stats");

const codeLookup = ref("");

function jumpToCode() {
  const trimmed = codeLookup.value.trim();
  if (!trimmed) return;
  navigateTo(`/legal/verify?code=${encodeURIComponent(trimmed)}`);
}

const funnelOptions = computed(() => ({
  plotOptions: {
    bar: { horizontal: true, borderRadius: 4, barHeight: "70%", distributed: true },
  },
  legend: { show: false },
  colors: ["#94A3B8", "#06B6D4", "#3B82F6", "#8B5CF6", "#F59E0B", "#10B981", "#6D28D9", "#EF4444"],
  xaxis: {
    categories: dashboard.value?.funnel.map((f) => f.status.replace("_", " ")) ?? [],
  },
}));
const funnelSeries = computed(() => [
  { name: "Declarations", data: dashboard.value?.funnel.map((f) => f.count) ?? [] },
]);

const throughputOptions = computed(() => ({
  xaxis: {
    categories:
      dashboard.value?.throughput.map((t) => {
        const d = new Date(t.date);
        return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
      }) ?? [],
    tickAmount: 6,
  },
}));
const throughputSeries = computed(() => [
  { name: "Codes Issued", data: dashboard.value?.throughput.map((t) => t.codes) ?? [] },
  { name: "Receipts Generated", data: dashboard.value?.throughput.map((t) => t.receipts) ?? [] },
]);

const quickActions = [
  {
    title: "Record Form Collection",
    description: "Record a physical form collected by an applicant",
    icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    href: "/officer/form-collections",
    color: "bg-cyan-500",
  },
  {
    title: "Record Form Return",
    description: "Record a completed form returned by an applicant",
    icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    href: "/officer/form-returns",
    color: "bg-teal-500",
  },
  {
    title: "Review Declarations",
    description: "Review submitted declarations section by section",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
    href: "/officer/reviews",
    color: "bg-green-500",
  },
  {
    title: "Generate Receipts",
    description: "Generate receipts for approved declarations",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
    href: "/officer/receipts",
    color: "bg-purple-500",
  },
];
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="Officer Dashboard" description="Manage asset declarations, reviews, and receipts" />

    <AnalyticsSealedSummaryWidget role="officer" />

    <!-- Code lookup -->
    <Card>
      <CardContent class="p-4">
        <form class="flex items-center gap-2" @submit.prevent="jumpToCode">
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <svg class="w-5 h-5 text-muted-foreground shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <Input
              v-model="codeLookup"
              placeholder="Look up by declaration code (e.g. ADLA-20260520-A3F7K)"
              class="font-mono"
            />
          </div>
          <Button type="submit" :disabled="!codeLookup.trim()">Verify</Button>
        </form>
      </CardContent>
    </Card>

    <!-- Pending Queues -->
    <div class="grid grid-cols-2 lg:grid-cols-3 gap-4">
      <AppStatCard
        label="Pending Form Collections"
        :value="dashboard?.queues.pendingFormCollections ?? 0"
        :loading="loading"
        footnote="Forms awaiting collection recording"
        href="/officer/form-collections"
        icon-bg="bg-cyan-100 dark:bg-cyan-950/50"
        icon-color="text-cyan-600 dark:text-cyan-400"
        icon-path="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
      <AppStatCard
        label="Pending Form Returns"
        :value="dashboard?.queues.pendingFormReturns ?? 0"
        :loading="loading"
        footnote="Completed forms awaiting return"
        href="/officer/form-returns"
        icon-bg="bg-teal-100 dark:bg-teal-950/50"
        icon-color="text-teal-600 dark:text-teal-400"
        icon-path="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
      <AppStatCard
        label="Pending Reviews"
        :value="dashboard?.queues.pendingReviews ?? 0"
        :loading="loading"
        footnote="Awaiting section review"
        href="/officer/reviews"
        icon-bg="bg-yellow-100 dark:bg-yellow-950/50"
        icon-color="text-yellow-600 dark:text-yellow-400"
        icon-path="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
      />
      <AppStatCard
        label="Under Review"
        :value="dashboard?.queues.underReview ?? 0"
        :loading="loading"
        footnote="Currently being reviewed"
        href="/officer/reviews"
        icon-bg="bg-purple-100 dark:bg-purple-950/50"
        icon-color="text-purple-600 dark:text-purple-400"
        icon-path="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
      <AppStatCard
        label="With Review Comments"
        :value="dashboard?.queues.withReviewComments ?? 0"
        :loading="loading"
        footnote="Have unresolved section issues"
        href="/officer/reviews"
        icon-bg="bg-amber-100 dark:bg-amber-950/50"
        icon-color="text-amber-600 dark:text-amber-400"
        icon-path="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
      <AppStatCard
        label="Pending Receipts"
        :value="dashboard?.queues.pendingReceipts ?? 0"
        :loading="loading"
        footnote="Ready for generation"
        href="/officer/receipts"
        icon-bg="bg-purple-100 dark:bg-purple-950/50"
        icon-color="text-purple-600 dark:text-purple-400"
        icon-path="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
      />
    </div>

    <!-- Code Issuance Volume -->
    <Card>
      <CardHeader>
        <CardTitle class="text-base">Codes Issued</CardTitle>
        <CardDescription>Declaration codes generated in recent periods</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="grid grid-cols-3 gap-4">
          <div class="space-y-1">
            <p class="text-xs text-muted-foreground uppercase tracking-wide">Today</p>
            <p class="text-2xl font-bold text-primary">{{ dashboard?.codeWindows.today ?? 0 }}</p>
          </div>
          <div class="space-y-1">
            <p class="text-xs text-muted-foreground uppercase tracking-wide">This Week</p>
            <p class="text-2xl font-bold text-foreground">{{ dashboard?.codeWindows.week ?? 0 }}</p>
          </div>
          <div class="space-y-1">
            <p class="text-xs text-muted-foreground uppercase tracking-wide">This Month</p>
            <p class="text-2xl font-bold text-foreground">{{ dashboard?.codeWindows.month ?? 0 }}</p>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Charts -->
    <div class="grid lg:grid-cols-2 gap-4">
      <AppChartCard
        title="Declaration Pipeline"
        description="Current count of declarations in each status"
        type="bar"
        :series="funnelSeries"
        :options="funnelOptions"
        :loading="loading"
        :height="320"
      />
      <AppChartCard
        title="Daily Throughput"
        description="Codes issued vs. receipts generated, last 30 days"
        type="area"
        :series="throughputSeries"
        :options="throughputOptions"
        :loading="loading"
        :height="320"
      />
    </div>

    <!-- Quick Actions -->
    <Card>
      <CardHeader>
        <CardTitle class="text-base">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <NuxtLink
            v-for="action in quickActions"
            :key="action.title"
            :to="action.href"
            class="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div :class="[action.color, 'w-10 h-10 rounded-lg flex items-center justify-center shrink-0']">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="action.icon" />
              </svg>
            </div>
            <div>
              <h3 class="font-medium text-foreground">{{ action.title }}</h3>
              <p class="text-sm text-muted-foreground">{{ action.description }}</p>
            </div>
          </NuxtLink>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
