<script setup lang="ts">
definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

interface OfficerDashboardData {
  queues: {
    pendingFormCollections: number;
    pendingFormReturns: number;
    pendingSubmissions: number;
    pendingReviews: number;
    pendingReceipts: number;
    pendingPickups: number;
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
  colors: ["#94A3B8", "#06B6D4", "#3B82F6", "#F59E0B", "#10B981", "#8B5CF6", "#EF4444"],
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
    title: "Record Submission",
    description: "Record a new declaration submission",
    icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    href: "/officer/submissions",
    color: "bg-blue-500",
  },
  {
    title: "Review Declarations",
    description: "Approve or reject pending declarations",
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
  {
    title: "Manage Pickups",
    description: "Schedule and record receipt pickups",
    icon: "M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4",
    href: "/officer/pickups",
    color: "bg-orange-500",
  },
];
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="Officer Dashboard" description="Manage asset declarations, reviews, and receipts" />

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
      <StatCard
        label="Pending Form Collections"
        :value="dashboard?.queues.pendingFormCollections ?? 0"
        :loading="loading"
        footnote="Forms awaiting collection recording"
        href="/officer/form-collections"
        icon-bg="bg-cyan-100"
        icon-color="text-cyan-600"
        icon-path="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
      <StatCard
        label="Pending Form Returns"
        :value="dashboard?.queues.pendingFormReturns ?? 0"
        :loading="loading"
        footnote="Completed forms awaiting return"
        href="/officer/form-returns"
        icon-bg="bg-teal-100"
        icon-color="text-teal-600"
        icon-path="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
      <StatCard
        label="Pending Submissions"
        :value="dashboard?.queues.pendingSubmissions ?? 0"
        :loading="loading"
        footnote="Awaiting recording"
        href="/officer/submissions"
        icon-bg="bg-blue-100"
        icon-color="text-blue-600"
        icon-path="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
      <StatCard
        label="Pending Reviews"
        :value="dashboard?.queues.pendingReviews ?? 0"
        :loading="loading"
        footnote="Awaiting approval"
        href="/officer/reviews"
        icon-bg="bg-yellow-100"
        icon-color="text-yellow-600"
        icon-path="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
      />
      <StatCard
        label="Pending Receipts"
        :value="dashboard?.queues.pendingReceipts ?? 0"
        :loading="loading"
        footnote="Ready for generation"
        href="/officer/receipts"
        icon-bg="bg-purple-100"
        icon-color="text-purple-600"
        icon-path="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
      />
      <StatCard
        label="Pending Pickups"
        :value="dashboard?.queues.pendingPickups ?? 0"
        :loading="loading"
        footnote="Scheduled for pickup"
        href="/officer/pickups"
        icon-bg="bg-orange-100"
        icon-color="text-orange-600"
        icon-path="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
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
      <ChartCard
        title="Declaration Pipeline"
        description="Current count of declarations in each status"
        type="bar"
        :series="funnelSeries"
        :options="funnelOptions"
        :loading="loading"
        :height="320"
      />
      <ChartCard
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
