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
      title="My Completed Declarations"
      description="Your sealed and completed asset declarations"
    />

    <AnalyticsFilterBar
      :filters="filters"
      :show-officer-filter="false"
      @apply="applyFilters"
      @reset="resetFilters"
    />

    <AnalyticsKpiCards :data="summary" :loading="loadingSummary" />

    <AnalyticsSealedTimelineChart
      :data="charts?.timeline"
      :loading="loadingCharts"
    />

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
