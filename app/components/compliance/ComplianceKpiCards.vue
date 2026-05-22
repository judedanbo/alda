<script setup lang="ts">
import type { ComplianceSummaryData } from "~/composables/useCompliance";

defineProps<{
  data: ComplianceSummaryData | null;
  loading: boolean;
  complianceHref?: string;
}>();

const cards = computed(() => [
  {
    label: "Overdue",
    key: "overdue" as const,
    borderColor: "border-l-red-500",
    valueColor: "text-red-600 dark:text-red-400",
    iconBg: "bg-red-100 dark:bg-red-950/50",
  },
  {
    label: "Due Now",
    key: "dueNow" as const,
    borderColor: "border-l-amber-500",
    valueColor: "text-amber-600 dark:text-amber-400",
    iconBg: "bg-amber-100 dark:bg-amber-950/50",
  },
  {
    label: "Upcoming",
    key: "upcoming" as const,
    borderColor: "border-l-blue-500",
    valueColor: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-blue-100 dark:bg-blue-950/50",
  },
  {
    label: "Compliance Rate",
    key: "complianceRate" as const,
    borderColor: "border-l-green-500",
    valueColor: "text-green-600 dark:text-green-400",
    iconBg: "bg-green-100 dark:bg-green-950/50",
  },
]);
</script>

<template>
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
    <NuxtLink
      v-for="card in cards"
      :key="card.key"
      :to="complianceHref ? `${complianceHref}${card.key !== 'complianceRate' ? `?status=${card.key === 'dueNow' ? 'due_now' : card.key}` : ''}` : undefined"
    >
      <Card class="border-l-4 hover:border-primary/50 transition-colors h-full" :class="card.borderColor">
        <CardContent class="p-4">
          <Skeleton v-if="loading" class="h-4 w-20 mb-2" />
          <Skeleton v-if="loading" class="h-8 w-16" />
          <template v-else>
            <p class="text-xs text-muted-foreground uppercase tracking-wide">
              {{ card.label }}
            </p>
            <p class="text-2xl font-extrabold mt-1" :class="card.valueColor">
              {{ card.key === "complianceRate"
                ? `${data?.complianceRate ?? 0}%`
                : (data?.[card.key] ?? 0).toLocaleString()
              }}
            </p>
            <p v-if="card.key !== 'complianceRate'" class="text-xs text-muted-foreground mt-1">
              obligations
            </p>
            <p v-else class="text-xs text-muted-foreground mt-1">
              of {{ data?.totalApplicantsWithOffices ?? 0 }} office holders
            </p>
          </template>
        </CardContent>
      </Card>
    </NuxtLink>
  </div>
</template>
