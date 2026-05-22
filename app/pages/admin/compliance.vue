<script setup lang="ts">
definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const {
  filters,
  summary,
  list,
  loadingSummary,
  loadingList,
  applyFilters,
  resetFilters,
  setPage,
  setSort,
} = useCompliance();
</script>

<template>
  <div class="space-y-6">
    <PageHeader
      title="Declaration Compliance"
      description="Monitor public office holders' compliance with Article 286(5) declaration obligations"
    />

    <ComplianceKpiCards
      :data="summary"
      :loading="loadingSummary"
    />

    <ComplianceFilterBar
      :filters="filters"
      @apply="applyFilters"
      @reset="resetFilters"
    />

    <ComplianceTable
      :data="list"
      :loading="loadingList"
      :sort-by="filters.sortBy"
      :sort-order="filters.sortOrder"
      @sort="setSort"
      @page="setPage"
    />
  </div>
</template>
