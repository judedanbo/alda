<script setup lang="ts">
import { authFetch } from "~/utils/authFetch";

const props = defineProps<{
  role: "admin" | "officer" | "legal" | "applicant";
}>();

interface WidgetData {
  totalSealed: number;
  avgProcessingDays: number;
  thisWeek: number;
}

const data = ref<WidgetData | null>(null);
const loading = ref(true);

onMounted(async () => {
  try {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekFrom = weekStart.toISOString().slice(0, 10);

    const [summaryRes, weekRes] = await Promise.all([
      authFetch<{ success: boolean; data: { totalSealed: number; avgProcessingDays: number } }>(
        "/api/analytics/declarations/summary",
      ),
      authFetch<{ success: boolean; data: { totalSealed: number } }>(
        `/api/analytics/declarations/summary?dateFrom=${weekFrom}`,
      ),
    ]);

    data.value = {
      totalSealed: summaryRes.data.totalSealed,
      avgProcessingDays: summaryRes.data.avgProcessingDays,
      thisWeek: weekRes.data.totalSealed,
    };
  } catch (e) {
    console.error("Failed to load sealed summary:", e);
  } finally {
    loading.value = false;
  }
});

const analyticsHref = computed(() => {
  const routes: Record<string, string> = {
    admin: "/admin/analytics",
    officer: "/officer/analytics",
    legal: "/legal/analytics",
    applicant: "/applicant/analytics",
  };
  return routes[props.role];
});

const labels = computed(() => {
  if (props.role === "officer") {
    return { total: "I Processed", avg: "My Avg Time", week: "This Week", link: "View Details →" };
  }
  if (props.role === "applicant") {
    return { total: "My Sealed", avg: "Avg Time", week: "This Week", link: "View All →" };
  }
  return { total: "Total Sealed", avg: "Avg Time", week: "This Week", link: "View Full Analytics →" };
});
</script>

<template>
  <Card>
    <CardContent class="p-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-semibold text-sm">Sealed Declarations</h3>
        <NuxtLink :to="analyticsHref" class="text-xs text-primary hover:underline">
          {{ labels.link }}
        </NuxtLink>
      </div>

      <div v-if="loading" class="grid grid-cols-3 gap-3">
        <Skeleton class="h-16" />
        <Skeleton class="h-16" />
        <Skeleton class="h-16" />
      </div>
      <div v-else-if="data" class="grid grid-cols-3 gap-3">
        <div class="text-center p-2 bg-primary/5 rounded-lg">
          <p class="text-xl font-extrabold text-primary">{{ data.totalSealed.toLocaleString() }}</p>
          <p class="text-[10px] text-muted-foreground">{{ labels.total }}</p>
        </div>
        <div class="text-center p-2 bg-sky-500/5 rounded-lg">
          <p class="text-xl font-extrabold text-sky-600">{{ data.avgProcessingDays }}d</p>
          <p class="text-[10px] text-muted-foreground">{{ labels.avg }}</p>
        </div>
        <div class="text-center p-2 bg-yellow-500/5 rounded-lg">
          <p class="text-xl font-extrabold text-yellow-700">{{ data.thisWeek }}</p>
          <p class="text-[10px] text-muted-foreground">{{ labels.week }}</p>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
