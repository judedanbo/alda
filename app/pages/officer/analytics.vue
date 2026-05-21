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
      title="My Sealed Declarations"
      description="Declarations you have processed and sealed"
    />

    <AnalyticsFilterBar
      :filters="filters"
      :show-officer-filter="false"
      :show-export="true"
      @apply="applyFilters"
      @reset="resetFilters"
      @export="exportData"
    />

    <AnalyticsKpiCards :data="summary" :loading="loadingSummary" />

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <AnalyticsSealedTimelineChart :data="charts?.timeline" :loading="loadingCharts" />
      <AnalyticsInstitutionChart :data="charts?.byInstitution" :loading="loadingCharts" />
      <AnalyticsCollectionOfficeChart :data="charts?.byCollectionOffice" :loading="loadingCharts" />
    </div>

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
