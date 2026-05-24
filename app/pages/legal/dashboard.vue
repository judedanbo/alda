<script setup lang="ts">
definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

interface VerificationStats {
  PENDING_VERIFICATION: number;
  VERIFIED: number;
  ON_HOLD: number;
  MORE_INFO_REQUIRED: number;
  REJECTED: number;
  total: number;
}

interface CodeActivityData {
  windows: { today: number; week: number; month: number; failedThisMonth: number };
  daily: { date: string; count: number }[];
  recentVerifications: {
    id: string;
    action: string;
    code: string | null;
    found: boolean;
    verifierEmail: string | null;
    createdAt: string;
  }[];
}

const { data: verificationStatsResponse } = await useAsyncData(
  "verification-stats",
  () => authFetch<{ data: VerificationStats }>("/api/legal/verifications/stats"),
);

const verificationStats = computed<VerificationStats>(() => verificationStatsResponse.value?.data || {
  PENDING_VERIFICATION: 0,
  ON_HOLD: 0,
  MORE_INFO_REQUIRED: 0,
  VERIFIED: 0,
  REJECTED: 0,
  total: 0,
});

const { data: codeActivity, loading: codeLoading } = useDashboardStats<CodeActivityData>("/api/legal/code-activity");

const { data: complianceSummary, loading: complianceLoading } = useDashboardStats<{
  totalApplicantsWithOffices: number;
  compliant: number;
  upcoming: number;
  dueNow: number;
  overdue: number;
  complianceRate: number;
}>("/api/analytics/compliance/summary");

const { data: reissueStatsData } = await useAsyncData(
  "form-reissue-stats",
  () => authFetch<{ data: Record<string, number> }>("/api/legal/form-reissues/stats"),
);

const reissueStats = computed(() => reissueStatsData.value?.data || {
  PENDING: 0,
  APPROVED: 0,
  DECLINED: 0,
  total: 0,
});

const quickCode = ref("");
function lookupQuickCode() {
  const trimmed = quickCode.value.trim();
  if (!trimmed) return;
  navigateTo(`/legal/verify?code=${encodeURIComponent(trimmed)}`);
}

const activitySeries = computed(() => [
  { name: "Verifications", data: codeActivity.value?.daily.map((d) => d.count) ?? [] },
]);
const activityOptions = computed(() => ({
  xaxis: {
    categories:
      codeActivity.value?.daily.map((d) => {
        const date = new Date(d.date);
        return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
      }) ?? [],
    tickAmount: 6,
  },
}));

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="Legal Unit Dashboard" description="Verify declaration codes and recall applicant information" />

    <AnalyticsSealedSummaryWidget role="legal" />

    <!-- Declaration Compliance -->
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold text-foreground">Declaration Compliance</h2>
      <NuxtLink to="/legal/compliance" class="text-sm text-primary hover:underline">
        View Details &rarr;
      </NuxtLink>
    </div>
    <ComplianceKpiCards
      :data="complianceSummary"
      :loading="complianceLoading"
      compliance-href="/legal/compliance"
    />

    <!-- Quick Code Verification -->
    <Card class="border-primary/30 bg-primary/5">
      <CardContent class="p-6">
        <form class="flex items-center gap-3 flex-wrap" @submit.prevent="lookupQuickCode">
          <div class="flex items-center gap-2 flex-1 min-w-[280px]">
            <svg class="w-5 h-5 text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <Input
              v-model="quickCode"
              placeholder="Enter declaration code (e.g. ADLA-20260520-A3F7K)"
              class="font-mono"
            />
          </div>
          <Button type="submit" :disabled="!quickCode.trim()">Verify Code</Button>
          <Button as-child variant="outline">
            <NuxtLink to="/legal/verify">Open Verification Page</NuxtLink>
          </Button>
        </form>
      </CardContent>
    </Card>

    <!-- Code Verification Activity -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <AppStatCard
        label="Verified Today"
        :value="codeActivity?.windows.today ?? 0"
        :loading="codeLoading"
        value-color="text-primary"
        icon-bg="bg-primary/10"
        icon-color="text-primary"
        icon-path="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
      <AppStatCard
        label="This Week"
        :value="codeActivity?.windows.week ?? 0"
        :loading="codeLoading"
        icon-bg="bg-blue-100 dark:bg-blue-950/50"
        icon-color="text-blue-600 dark:text-blue-400"
        icon-path="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
      <AppStatCard
        label="This Month"
        :value="codeActivity?.windows.month ?? 0"
        :loading="codeLoading"
        icon-bg="bg-blue-100 dark:bg-blue-950/50"
        icon-color="text-blue-600 dark:text-blue-400"
        icon-path="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
      <AppStatCard
        label="Failed Lookups"
        :value="codeActivity?.windows.failedThisMonth ?? 0"
        :loading="codeLoading"
        footnote="This month — invalid codes"
        value-color="text-red-600 dark:text-red-400"
        icon-bg="bg-red-100 dark:bg-red-950/50"
        icon-color="text-red-600 dark:text-red-400"
        icon-path="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </div>

    <!-- Activity chart + Recent verifications -->
    <div class="grid lg:grid-cols-3 gap-4">
      <div class="lg:col-span-2">
        <AppChartCard
          title="Verification Activity"
          description="Code lookups per day, last 30 days"
          type="area"
          :series="activitySeries"
          :options="activityOptions"
          :loading="codeLoading"
          :height="300"
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle class="text-base">Recent Verifications</CardTitle>
          <CardDescription>Last 10 code lookups</CardDescription>
        </CardHeader>
        <CardContent class="p-0">
          <div v-if="codeLoading" class="space-y-2 p-4">
            <Skeleton v-for="i in 5" :key="i" class="h-12 w-full" />
          </div>
          <div v-else-if="!codeActivity?.recentVerifications.length" class="text-sm text-muted-foreground py-8 text-center">
            No verifications recorded yet.
          </div>
          <div v-else class="divide-y max-h-[300px] overflow-y-auto">
            <div
              v-for="row in codeActivity.recentVerifications"
              :key="row.id"
              class="flex items-start justify-between gap-2 p-3 hover:bg-muted/30"
            >
              <div class="min-w-0 flex-1">
                <code class="font-mono text-xs">{{ row.code ?? '—' }}</code>
                <p class="text-xs text-muted-foreground mt-1">
                  {{ formatTimestamp(row.createdAt) }}
                  <span v-if="row.verifierEmail"> · {{ row.verifierEmail }}</span>
                </p>
              </div>
              <Badge
:class="row.found
                ? 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300'
                : 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300'">
                {{ row.found ? 'Found' : 'Invalid' }}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Applicant Verification Statistics -->
    <h2 class="text-lg font-semibold text-foreground pt-2">Applicant Verification</h2>
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <NuxtLink to="/legal/verifications?status=PENDING_VERIFICATION">
        <Card class="hover:border-primary/50 transition-colors h-full">
          <CardContent class="p-6">
            <p class="text-sm text-muted-foreground">Pending Review</p>
            <p class="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-2">{{ verificationStats.PENDING_VERIFICATION }}</p>
          </CardContent>
        </Card>
      </NuxtLink>
      <NuxtLink to="/legal/verifications?status=ON_HOLD">
        <Card class="hover:border-primary/50 transition-colors h-full">
          <CardContent class="p-6">
            <p class="text-sm text-muted-foreground">On Hold</p>
            <p class="text-3xl font-bold text-orange-600 dark:text-orange-400 mt-2">{{ verificationStats.ON_HOLD }}</p>
          </CardContent>
        </Card>
      </NuxtLink>
      <NuxtLink to="/legal/verifications?status=MORE_INFO_REQUIRED">
        <Card class="hover:border-primary/50 transition-colors h-full">
          <CardContent class="p-6">
            <p class="text-sm text-muted-foreground">More Info Required</p>
            <p class="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">{{ verificationStats.MORE_INFO_REQUIRED }}</p>
          </CardContent>
        </Card>
      </NuxtLink>
      <NuxtLink to="/legal/verifications?status=VERIFIED">
        <Card class="hover:border-primary/50 transition-colors h-full">
          <CardContent class="p-6">
            <p class="text-sm text-muted-foreground">Verified</p>
            <p class="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">{{ verificationStats.VERIFIED }}</p>
          </CardContent>
        </Card>
      </NuxtLink>
    </div>

    <!-- Form Reissue Summary -->
    <h2 class="text-lg font-semibold text-foreground">Form Reissue Requests</h2>
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <NuxtLink to="/legal/form-reissues?status=PENDING">
        <Card class="hover:border-primary/50 transition-colors">
          <CardContent class="p-6">
            <p class="text-sm text-muted-foreground">Pending Reissues</p>
            <p class="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-2">
              {{ reissueStats.PENDING }}
            </p>
          </CardContent>
        </Card>
      </NuxtLink>
      <NuxtLink to="/legal/form-reissues?status=APPROVED">
        <Card class="hover:border-primary/50 transition-colors">
          <CardContent class="p-6">
            <p class="text-sm text-muted-foreground">Approved</p>
            <p class="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">
              {{ reissueStats.APPROVED }}
            </p>
          </CardContent>
        </Card>
      </NuxtLink>
      <NuxtLink to="/legal/form-reissues?status=DECLINED">
        <Card class="hover:border-primary/50 transition-colors">
          <CardContent class="p-6">
            <p class="text-sm text-muted-foreground">Declined</p>
            <p class="text-3xl font-bold text-red-600 dark:text-red-400 mt-2">
              {{ reissueStats.DECLINED }}
            </p>
          </CardContent>
        </Card>
      </NuxtLink>
      <NuxtLink to="/legal/form-reissues?status=ALL">
        <Card class="hover:border-primary/50 transition-colors">
          <CardContent class="p-6">
            <p class="text-sm text-muted-foreground">Total</p>
            <p class="text-3xl font-bold text-foreground mt-2">
              {{ reissueStats.total }}
            </p>
          </CardContent>
        </Card>
      </NuxtLink>
    </div>

    <!-- Reference info -->
    <div class="grid lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle class="text-base">Code Format</CardTitle>
        </CardHeader>
        <CardContent class="space-y-3">
          <code class="block px-4 py-2 bg-muted rounded text-sm font-mono">ADLA-YYYYMMDD-XXXXX</code>
          <div class="text-sm text-muted-foreground space-y-1">
            <p><strong>ADLA</strong> — System prefix</p>
            <p><strong>YYYYMMDD</strong> — Date issued</p>
            <p><strong>XXXXX</strong> — Unique identifier</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle class="text-base">Declaration Status Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="grid grid-cols-2 gap-3">
            <div class="text-center p-3 bg-muted/50 rounded-lg">
              <StatusBadge status="CODE_GENERATED" class="mb-2" />
              <p class="text-xs text-muted-foreground">Code issued</p>
            </div>
            <div class="text-center p-3 bg-muted/50 rounded-lg">
              <StatusBadge status="FORM_COLLECTED" class="mb-2" />
              <p class="text-xs text-muted-foreground">Form collected</p>
            </div>
            <div class="text-center p-3 bg-muted/50 rounded-lg">
              <StatusBadge status="SUBMITTED" class="mb-2" />
              <p class="text-xs text-muted-foreground">Awaiting review</p>
            </div>
            <div class="text-center p-3 bg-muted/50 rounded-lg">
              <StatusBadge status="UNDER_REVIEW" class="mb-2" />
              <p class="text-xs text-muted-foreground">Being reviewed</p>
            </div>
            <div class="text-center p-3 bg-muted/50 rounded-lg">
              <StatusBadge status="APPROVED" class="mb-2" />
              <p class="text-xs text-muted-foreground">Pending receipt</p>
            </div>
            <div class="text-center p-3 bg-muted/50 rounded-lg">
              <StatusBadge status="SEALED" class="mb-2" />
              <p class="text-xs text-muted-foreground">Complete</p>
            </div>
            <div class="text-center p-3 bg-muted/50 rounded-lg">
              <StatusBadge status="REJECTED" class="mb-2" />
              <p class="text-xs text-muted-foreground">Resubmission needed</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
