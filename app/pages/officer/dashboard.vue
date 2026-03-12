<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";

definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const authStore = useAuthStore();

interface DashboardStats {
  pendingSubmissions: number;
  pendingReviews: number;
  pendingReceipts: number;
  pendingPickups: number;
  todaySubmissions: number;
  todayApprovals: number;
  todayRejections: number;
}

const stats = ref<DashboardStats>({
  pendingSubmissions: 0,
  pendingReviews: 0,
  pendingReceipts: 0,
  pendingPickups: 0,
  todaySubmissions: 0,
  todayApprovals: 0,
  todayRejections: 0,
});

const recentActivity = ref<Array<{
  id: string;
  action: string;
  description: string;
  time: string;
}>>([]);

const loading = ref(true);

const fetchDashboardData = async () => {
  try {
    const [
      pendingSubmissionsRes,
      pendingReviewsRes,
      pendingReceiptsRes,
      pendingPickupsRes,
    ] = await Promise.all([
      $fetch("/api/submissions/pending?limit=1", {
        headers: authStore.getAuthHeaders(),
      }),
      $fetch("/api/reviews/pending?limit=1", {
        headers: authStore.getAuthHeaders(),
      }),
      $fetch("/api/receipts/pending?limit=1", {
        headers: authStore.getAuthHeaders(),
      }),
      $fetch("/api/pickup/pending?limit=1", {
        headers: authStore.getAuthHeaders(),
      }),
    ]);

    stats.value = {
      pendingSubmissions: pendingSubmissionsRes.data?.total || 0,
      pendingReviews: pendingReviewsRes.data?.total || 0,
      pendingReceipts: pendingReceiptsRes.data?.total || 0,
      pendingPickups: pendingPickupsRes.data?.total || 0,
      todaySubmissions: 0,
      todayApprovals: 0,
      todayRejections: 0,
    };
  } catch (error) {
    console.error("Failed to fetch dashboard data:", error);
  } finally {
    loading.value = false;
  }
};

await fetchDashboardData();

const quickActions = [
  {
    title: "Record Submission",
    description: "Record a new declaration submission",
    icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    href: "/officer/submissions",
    color: "bg-blue-500",
  },
  {
    title: "Review Declarations",
    description: "Approve or reject pending declarations",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
    href: "/officer/reviews",
    color: "bg-green-500",
  },
  {
    title: "Generate Receipts",
    description: "Generate receipts for approved declarations",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
    href: "/officer/receipts",
    color: "bg-purple-500",
  },
  {
    title: "Manage Pickups",
    description: "Schedule and record receipt pickups",
    icon: "M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4",
    href: "/officer/pickups",
    color: "bg-orange-500",
  },
];
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-foreground">Officer Dashboard</h1>
      <p class="text-muted-foreground mt-1">
        Manage asset declarations, reviews, and receipts
      </p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-12">
      <div class="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>

    <template v-else>
      <!-- Stats Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <NuxtLink
          to="/officer/submissions"
          class="bg-card border rounded-lg p-6 hover:border-primary transition-colors"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-muted-foreground">Pending Submissions</p>
              <p class="text-3xl font-bold text-foreground mt-1">
                {{ stats.pendingSubmissions }}
              </p>
            </div>
            <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
          <p class="text-xs text-muted-foreground mt-2">
            Declarations awaiting recording
          </p>
        </NuxtLink>

        <NuxtLink
          to="/officer/reviews"
          class="bg-card border rounded-lg p-6 hover:border-primary transition-colors"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-muted-foreground">Pending Reviews</p>
              <p class="text-3xl font-bold text-foreground mt-1">
                {{ stats.pendingReviews }}
              </p>
            </div>
            <div class="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
              <svg class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
          </div>
          <p class="text-xs text-muted-foreground mt-2">
            Awaiting approval/rejection
          </p>
        </NuxtLink>

        <NuxtLink
          to="/officer/receipts"
          class="bg-card border rounded-lg p-6 hover:border-primary transition-colors"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-muted-foreground">Pending Receipts</p>
              <p class="text-3xl font-bold text-foreground mt-1">
                {{ stats.pendingReceipts }}
              </p>
            </div>
            <div class="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
          </div>
          <p class="text-xs text-muted-foreground mt-2">
            Ready for receipt generation
          </p>
        </NuxtLink>

        <NuxtLink
          to="/officer/pickups"
          class="bg-card border rounded-lg p-6 hover:border-primary transition-colors"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm text-muted-foreground">Pending Pickups</p>
              <p class="text-3xl font-bold text-foreground mt-1">
                {{ stats.pendingPickups }}
              </p>
            </div>
            <div class="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <svg class="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </div>
          </div>
          <p class="text-xs text-muted-foreground mt-2">
            Scheduled for pickup
          </p>
        </NuxtLink>
      </div>

      <!-- Quick Actions -->
      <div class="bg-card border rounded-lg p-6">
        <h2 class="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <NuxtLink
            v-for="action in quickActions"
            :key="action.title"
            :to="action.href"
            class="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div :class="[action.color, 'w-10 h-10 rounded-lg flex items-center justify-center shrink-0']">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="action.icon" />
              </svg>
            </div>
            <div>
              <h3 class="font-medium text-foreground">{{ action.title }}</h3>
              <p class="text-sm text-muted-foreground">{{ action.description }}</p>
            </div>
          </NuxtLink>
        </div>
      </div>

      <!-- Workflow Overview -->
      <div class="bg-card border rounded-lg p-6">
        <h2 class="text-lg font-semibold text-foreground mb-4">Declaration Workflow</h2>
        <div class="flex items-center justify-between overflow-x-auto pb-2">
          <div class="flex items-center gap-2 min-w-max">
            <div class="flex flex-col items-center">
              <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <span class="text-blue-600 font-bold">1</span>
              </div>
              <span class="text-xs text-muted-foreground mt-1">Submitted</span>
            </div>
            <div class="w-8 h-0.5 bg-gray-300" />
            <div class="flex flex-col items-center">
              <div class="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                <span class="text-yellow-600 font-bold">2</span>
              </div>
              <span class="text-xs text-muted-foreground mt-1">Record</span>
            </div>
            <div class="w-8 h-0.5 bg-gray-300" />
            <div class="flex flex-col items-center">
              <div class="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <span class="text-orange-600 font-bold">3</span>
              </div>
              <span class="text-xs text-muted-foreground mt-1">Review</span>
            </div>
            <div class="w-8 h-0.5 bg-gray-300" />
            <div class="flex flex-col items-center">
              <div class="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <span class="text-purple-600 font-bold">4</span>
              </div>
              <span class="text-xs text-muted-foreground mt-1">Receipt</span>
            </div>
            <div class="w-8 h-0.5 bg-gray-300" />
            <div class="flex flex-col items-center">
              <div class="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <span class="text-green-600 font-bold">5</span>
              </div>
              <span class="text-xs text-muted-foreground mt-1">Pickup</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
