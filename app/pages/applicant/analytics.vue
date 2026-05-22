<script setup lang="ts">
definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

interface DeclarationStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

const { data: stats, loading: statsLoading } = useDashboardStats<DeclarationStats>("/api/declarations/stats");

const {
  filters,
  summary,
  charts,
  list,
  loadingSummary,
  loadingCharts,
  loadingList,
  applyFilters,
  resetFilters,
  setPage,
  setSort,
} = useAnalytics();
</script>

<template>
  <div class="space-y-6">
    <AppPageHeader
      title="My Completed Declarations"
      description="Your sealed and completed asset declarations"
    />

    <div data-tour="analytics-stats" class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <AppStatCard
        label="Total Declarations"
        :value="stats?.total ?? 0"
        :loading="statsLoading"
        icon-bg="bg-blue-100"
        icon-color="text-blue-600"
        icon-path="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
      <AppStatCard
        label="Pending Review"
        :value="stats?.pending ?? 0"
        :loading="statsLoading"
        icon-bg="bg-yellow-100"
        icon-color="text-yellow-600"
        icon-path="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
      <AppStatCard
        label="Approved"
        :value="stats?.approved ?? 0"
        :loading="statsLoading"
        value-color="text-emerald-600"
        icon-bg="bg-emerald-100"
        icon-color="text-emerald-600"
        icon-path="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
      <AppStatCard
        label="Rejected"
        :value="stats?.rejected ?? 0"
        :loading="statsLoading"
        value-color="text-red-600"
        icon-bg="bg-red-100"
        icon-color="text-red-600"
        icon-path="M6 18L18 6M6 6l12 12"
      />
    </div>

    <AnalyticsFilterBar
      v-model:filters="filters"
      data-tour="analytics-filters"
      :show-officer-filter="false"
      @apply="applyFilters"
      @reset="resetFilters"
    />

    <AnalyticsKpiCards
      data-tour="analytics-kpis"
      :data="summary"
      :loading="loadingSummary"
    />

    <AnalyticsSealedTimelineChart
      data-tour="analytics-timeline"
      :data="charts?.timeline"
      :loading="loadingCharts"
    />

    <AnalyticsDeclarationsTable
      data-tour="analytics-table"
      :data="list"
      :loading="loadingList"
      :sort-by="filters.sortBy"
      :sort-order="filters.sortOrder"
      @sort="setSort"
      @page="setPage"
    />
  </div>
</template>
