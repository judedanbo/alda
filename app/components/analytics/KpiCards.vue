<script setup lang="ts">
import type { SummaryData } from "~/composables/useAnalytics";

function formatChange(val: number | null): string {
  if (val === null) return "";
  return val > 0 ? `↑ ${val}%` : val < 0 ? `↓ ${Math.abs(val)}%` : "0%";
}

function changeClass(val: number | null, invertGood = false): string {
  if (val === null) return "text-muted-foreground";
  const isGood = invertGood ? val < 0 : val > 0;
  return isGood ? "text-green-600" : val === 0 ? "text-muted-foreground" : "text-red-600";
}

const props = defineProps<{
  data: SummaryData | null;
  loading: boolean;
}>();

const cards = computed(() => {
  const d = props.data;
  return [
    {
      label: "Total Sealed",
      value: d?.totalSealed.toLocaleString() ?? "—",
      change: d?.comparisons.totalSealed.changePercent ?? null,
      borderColor: "border-l-primary",
      invertGood: false,
    },
    {
      label: "Avg Processing Time",
      value: d ? `${d.avgProcessingDays} days` : "—",
      change: d?.comparisons.avgProcessingDays.changePercent ?? null,
      borderColor: "border-l-sky-500",
      invertGood: true,
    },
    {
      label: "Offices Covered",
      value: d ? `${d.officesCovered}` : "—",
      footnote: d ? `of ${d.totalOffices} total` : "",
      borderColor: "border-l-yellow-500",
      invertGood: false,
    },
    {
      label: "Form Reissue Rate",
      value: d ? `${d.formReissueRate}%` : "—",
      borderColor: "border-l-purple-500",
      invertGood: false,
    },
    {
      label: "Rejection Rate",
      value: d ? `${d.rejectionRate}%` : "—",
      change: d?.comparisons.rejectionRate.changePercent ?? null,
      borderColor: "border-l-destructive",
      invertGood: true,
    },
  ];
});
</script>

<template>
  <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
    <Card
      v-for="(card, i) in cards"
      :key="i"
      class="border-l-4"
      :class="card.borderColor"
    >
      <CardContent class="p-4">
        <Skeleton v-if="loading" class="h-4 w-20 mb-2" />
        <Skeleton v-if="loading" class="h-8 w-16" />
        <template v-else>
          <p class="text-xs text-muted-foreground uppercase tracking-wide">
            {{ card.label }}
          </p>
          <p class="text-2xl font-extrabold mt-1">{{ card.value }}</p>
          <p
            v-if="card.change !== undefined && card.change !== null"
            class="text-xs mt-1"
            :class="changeClass(card.change, card.invertGood)"
          >
            {{ formatChange(card.change) }} vs prev period
          </p>
          <p
            v-else-if="card.footnote"
            class="text-xs text-muted-foreground mt-1"
          >
            {{ card.footnote }}
          </p>
        </template>
      </CardContent>
    </Card>
  </div>
</template>
