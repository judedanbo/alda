<script setup lang="ts">
definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

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
  exportData,
} = useAnalytics();
</script>

<template>
  <div class="space-y-6">
    <AppPageHeader
      title="Sealed Declarations Analytics"
      description="Comprehensive view of all completed and sealed declarations"
    />

    <!-- Zone 1: Filters -->
    <AnalyticsFilterBar
      v-model:filters="filters"
      :show-officer-filter="true"
      :show-export="true"
      @apply="applyFilters"
      @reset="resetFilters"
      @export="exportData"
    />

    <!-- Zone 2: KPIs -->
    <AnalyticsKpiCards :data="summary" :loading="loadingSummary" />

    <!-- Zone 3: Charts -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <AnalyticsSealedTimelineChart
        :data="charts?.timeline"
        :loading="loadingCharts"
      />
      <AnalyticsInstitutionChart
        :data="charts?.byInstitution"
        :loading="loadingCharts"
      />
      <AnalyticsCollectionOfficeChart
        :data="charts?.byCollectionOffice"
        :loading="loadingCharts"
      />
      <AnalyticsOfficerPerformanceChart
        :data="charts?.officerPerformance"
        :loading="loadingCharts"
      />
    </div>

    <!-- Zone 4: Detail Table -->
    <AnalyticsDeclarationsTable
      :data="list"
      :loading="loadingList"
      :sort-by="filters.sortBy"
      :sort-order="filters.sortOrder"
      @sort="setSort"
      @page="setPage"
    />
  </div>
</template>
