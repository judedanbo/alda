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
} = useAnalytics();
</script>

<template>
  <div class="space-y-6">
    <AppPageHeader
      title="Sealed Declarations"
      description="All completed and sealed declarations for verification reference"
    />

    <AnalyticsFilterBar
      :filters="filters"
      :show-officer-filter="false"
      @apply="applyFilters"
      @reset="resetFilters"
    />

    <AnalyticsKpiCards :data="summary" :loading="loadingSummary" />

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <AnalyticsSealedTimelineChart :data="charts?.timeline" :loading="loadingCharts" />
      <AnalyticsInstitutionChart :data="charts?.byInstitution" :loading="loadingCharts" />
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
