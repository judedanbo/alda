<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";

definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const route = useRoute();
const authStore = useAuthStore();

const id = route.params.id as string;

// Fetch declaration status
const { data, pending, error, refresh } = await useFetch(`/api/declarations/${id}/status`, {
  headers: authStore.getAuthHeaders(),
});

const declaration = computed(() => data.value?.data);

// Status indicator
const statusInfo: Record<string, { color: string; icon: string; bg: string }> = {
  PENDING: { color: "text-yellow-600", icon: "clock", bg: "bg-yellow-100" },
  SUBMITTED: { color: "text-blue-600", icon: "send", bg: "bg-blue-100" },
  UNDER_REVIEW: { color: "text-purple-600", icon: "eye", bg: "bg-purple-100" },
  APPROVED: { color: "text-green-600", icon: "check", bg: "bg-green-100" },
  REJECTED: { color: "text-red-600", icon: "x", bg: "bg-red-100" },
  SEALED: { color: "text-gray-600", icon: "lock", bg: "bg-gray-100" },
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Timeline icon based on status
const getTimelineIcon = (status: string) => {
  const icons: Record<string, string> = {
    CREATED: "M12 4v16m8-8H4",
    SUBMITTED: "M12 19l9 2-9-18-9 18 9-2zm0 0v-8",
    RECORDED: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    APPROVED: "M5 13l4 4L19 7",
    REJECTED: "M6 18L18 6M6 6l12 12",
    RECEIPT_READY: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    SEALED: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
  };
  return icons[status] || icons.CREATED;
};
</script>

<template>
  <div class="max-w-4xl mx-auto">
    <!-- Back Link -->
    <NuxtLink
      to="/applicant/declarations"
      class="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
      Back to Declarations
    </NuxtLink>

    <!-- Loading -->
    <div v-if="pending" class="text-center py-12">
      <div class="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
      <p class="text-muted-foreground mt-4">Loading declaration...</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="text-center py-12 bg-card rounded-lg border">
      <p class="text-destructive mb-4">Failed to load declaration</p>
      <button class="text-primary hover:underline" @click="refresh()">
        Try again
      </button>
    </div>

    <!-- Declaration Details -->
    <template v-else-if="declaration">
      <!-- Header Card -->
      <div class="bg-card rounded-lg border p-6 mb-6">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p class="text-sm text-muted-foreground mb-1">Declaration Code</p>
            <h1 class="text-3xl font-bold font-mono text-foreground">
              {{ declaration.uniqueCode }}
            </h1>
          </div>
          <div
            class="inline-flex items-center gap-2 px-4 py-2 rounded-full"
            :class="statusInfo[declaration.status]?.bg"
          >
            <span
              class="w-2 h-2 rounded-full"
              :class="statusInfo[declaration.status]?.color.replace('text-', 'bg-')"
            />
            <span
              class="font-medium"
              :class="statusInfo[declaration.status]?.color"
            >
              {{ declaration.status.replace('_', ' ') }}
            </span>
          </div>
        </div>
      </div>

      <!-- Rejection Reason -->
      <div
        v-if="declaration.latestReview?.status === 'REJECTED'"
        class="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6"
      >
        <h3 class="font-medium text-destructive mb-2">Rejection Reason</h3>
        <p class="text-foreground">{{ declaration.latestReview.rejectionReason }}</p>
      </div>

      <!-- Receipt Info -->
      <div
        v-if="declaration.receipt"
        class="bg-success/10 border border-success/20 rounded-lg p-4 mb-6"
      >
        <h3 class="font-medium text-success mb-2">Receipt Ready</h3>
        <p class="text-foreground">
          Receipt Number: <span class="font-mono font-bold">{{ declaration.receipt.receiptNumber }}</span>
        </p>
      </div>

      <!-- Timeline -->
      <div class="bg-card rounded-lg border p-6">
        <h2 class="text-lg font-semibold text-foreground mb-6">Declaration Timeline</h2>

        <div class="relative">
          <!-- Timeline line -->
          <div class="absolute left-4 top-0 bottom-0 w-0.5 bg-muted" />

          <!-- Timeline items -->
          <div class="space-y-6">
            <div
              v-for="(event, index) in declaration.timeline"
              :key="index"
              class="relative flex gap-4"
            >
              <!-- Icon -->
              <div
                class="relative z-10 w-8 h-8 rounded-full flex items-center justify-center"
                :class="[
                  index === declaration.timeline.length - 1
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                ]"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    :d="getTimelineIcon(event.status)"
                  />
                </svg>
              </div>

              <!-- Content -->
              <div class="flex-1 pb-6">
                <div class="flex items-start justify-between">
                  <div>
                    <h3 class="font-medium text-foreground">{{ event.title }}</h3>
                    <p class="text-sm text-muted-foreground mt-1">{{ event.description }}</p>
                  </div>
                  <time class="text-sm text-muted-foreground whitespace-nowrap ml-4">
                    {{ formatDate(event.date) }}
                  </time>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div
        v-if="declaration.status === 'PENDING'"
        class="mt-6 p-4 bg-muted/50 rounded-lg flex items-center justify-between"
      >
        <p class="text-muted-foreground">
          Your declaration is pending submission
        </p>
        <NuxtLink
          :to="`/applicant/declaration/${id}/submit`"
          class="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
        >
          Submit Declaration
        </NuxtLink>
      </div>
    </template>
  </div>
</template>
