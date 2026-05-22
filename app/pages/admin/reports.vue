<script setup lang="ts">
definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

interface ReportData {
  declarationsByStatus: Array<{ status: string; count: number }>;
  declarationsByMonth: Array<{ month: string; count: number }>;
  usersByRole: Array<{ role: string; count: number }>;
  topInstitutions: Array<{ name: string; count: number }>;
  processingTimes: {
    avgSubmissionToReview: number;
    avgReviewToReceipt: number;
  };
}

const reportData = ref<ReportData | null>(null);
const loading = ref(true);

const dateFrom = ref("");
const dateTo = ref("");

const fetchReportData = async () => {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (dateFrom.value) params.append("dateFrom", dateFrom.value);
    if (dateTo.value) params.append("dateTo", dateTo.value);

    const response = await authFetch<{ success: boolean; data: ReportData }>(`/api/admin/reports?${params}`);

    if (response.success) {
      reportData.value = response.data;
    }
  } catch (error) {
    console.error("Failed to fetch report data:", error);
  } finally {
    loading.value = false;
  }
};

await fetchReportData();

const getStatusBarColor = (status: string) => {
  const colors: Record<string, string> = {
    CODE_GENERATED: "bg-amber-500",
    FORM_COLLECTED: "bg-cyan-500",
    SUBMITTED: "bg-blue-500",
    UNDER_REVIEW: "bg-purple-500",
    APPROVED: "bg-green-500",
    REJECTED: "bg-red-500",
    SEALED: "bg-purple-500",
  };
  return colors[status] || "bg-gray-500";
};

const formatDays = (hours: number) => {
  if (hours < 24) return `${Math.round(hours)} hours`;
  const days = Math.round(hours / 24);
  return `${days} day${days > 1 ? 's' : ''}`;
};

const maxDeclarationCount = computed(() => {
  if (!reportData.value) return 0;
  return Math.max(...reportData.value.declarationsByStatus.map((d) => d.count), 1);
});

const maxMonthlyCount = computed(() => {
  if (!reportData.value) return 0;
  return Math.max(...reportData.value.declarationsByMonth.map((d) => d.count), 1);
});

const exportReport = async (format: 'csv' | 'pdf') => {
  try {
    const params = new URLSearchParams({ format });
    if (dateFrom.value) params.append("dateFrom", dateFrom.value);
    if (dateTo.value) params.append("dateTo", dateTo.value);

    const response = await authFetch<Record<string, unknown>>(`/api/admin/reports/export?${params}`);

    // Handle file download
    if (format === 'csv' && response) {
      const blob = new Blob([response as unknown as string], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error("Failed to export report:", error);
  }
};
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="Reports" description="System analytics and statistics">
      <template #actions>
        <Button variant="outline" @click="exportReport('csv')">Export CSV</Button>
      </template>
    </PageHeader>

    <!-- Date Range Filter -->
    <Card>
      <CardContent class="pt-6">
        <div class="flex flex-col md:flex-row gap-4 items-end">
          <div class="flex-1">
            <Label for="date-from">From Date</Label>
            <Input
              id="date-from"
              v-model="dateFrom"
              type="date"
              class="mt-1"
            />
          </div>
          <div class="flex-1">
            <Label for="date-to">To Date</Label>
            <Input
              id="date-to"
              v-model="dateTo"
              type="date"
              class="mt-1"
            />
          </div>
          <Button @click="fetchReportData">Update Report</Button>
        </div>
      </CardContent>
    </Card>

    <!-- Loading -->
    <div v-if="loading" class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton v-for="i in 3" :key="i" class="h-24 rounded-lg" />
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton v-for="i in 4" :key="i" class="h-64 rounded-lg" />
      </div>
    </div>

    <template v-else-if="reportData">
      <!-- Summary Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent class="pt-6">
            <h3 class="text-sm font-medium text-muted-foreground mb-1">Avg. Submission to Review</h3>
            <p class="text-2xl font-bold text-foreground">
              {{ formatDays(reportData.processingTimes.avgSubmissionToReview) }}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent class="pt-6">
            <h3 class="text-sm font-medium text-muted-foreground mb-1">Avg. Review to Receipt</h3>
            <p class="text-2xl font-bold text-foreground">
              {{ formatDays(reportData.processingTimes.avgReviewToReceipt) }}
            </p>
          </CardContent>
        </Card>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Declarations by Status -->
        <Card>
          <CardHeader>
            <CardTitle>Declarations by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="space-y-3">
              <div
                v-for="item in reportData.declarationsByStatus"
                :key="item.status"
                class="flex items-center gap-3"
              >
                <div class="w-24 text-sm text-muted-foreground">{{ item.status }}</div>
                <div class="flex-1 h-6 bg-muted rounded overflow-hidden">
                  <div
                    class="h-full rounded"
                    :class="getStatusBarColor(item.status)"
                    :style="{ width: `${(item.count / maxDeclarationCount) * 100}%` }"
                  />
                </div>
                <div class="w-12 text-sm font-medium text-foreground text-right">
                  {{ item.count }}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- Users by Role -->
        <Card>
          <CardHeader>
            <CardTitle>Users by Role</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="space-y-3">
              <div
                v-for="item in reportData.usersByRole"
                :key="item.role"
                class="flex items-center justify-between p-3 bg-muted/50 rounded"
              >
                <span class="text-sm font-medium text-foreground">{{ item.role }}</span>
                <span class="text-lg font-bold text-primary">{{ item.count }}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- Monthly Declarations -->
        <Card>
          <CardHeader>
            <CardTitle>Declarations by Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div class="space-y-2">
              <div
                v-for="item in reportData.declarationsByMonth"
                :key="item.month"
                class="flex items-center gap-3"
              >
                <div class="w-20 text-xs text-muted-foreground">{{ item.month }}</div>
                <div class="flex-1 h-4 bg-muted rounded overflow-hidden">
                  <div
                    class="h-full bg-primary rounded"
                    :style="{ width: `${(item.count / maxMonthlyCount) * 100}%` }"
                  />
                </div>
                <div class="w-10 text-xs font-medium text-foreground text-right">
                  {{ item.count }}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- Top Institutions -->
        <Card>
          <CardHeader>
            <CardTitle>Top Institutions</CardTitle>
          </CardHeader>
          <CardContent>
            <div v-if="reportData.topInstitutions.length === 0" class="text-center py-4 text-muted-foreground">
              No data available
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="(item, index) in reportData.topInstitutions"
                :key="item.name"
                class="flex items-center gap-3 p-2"
              >
                <div class="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <span class="text-xs font-bold text-primary">{{ index + 1 }}</span>
                </div>
                <div class="flex-1 text-sm text-foreground truncate">{{ item.name }}</div>
                <div class="text-sm font-medium text-muted-foreground">
                  {{ item.count }} declarations
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </template>
  </div>
</template>
