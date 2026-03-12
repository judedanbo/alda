<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";

definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const authStore = useAuthStore();

const page = ref(1);
const statusFilter = ref("");

// Fetch declarations
const { data, pending, error, refresh } = await useFetch("/api/declarations", {
  headers: authStore.getAuthHeaders(),
  query: {
    page,
    limit: 10,
    status: statusFilter,
  },
  watch: [page, statusFilter],
});

const declarations = computed(() => data.value?.data?.declarations || []);
const pagination = computed(() => data.value?.data?.pagination);

// Status badge colors
const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  SUBMITTED: "bg-blue-100 text-blue-800",
  UNDER_REVIEW: "bg-purple-100 text-purple-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  SEALED: "bg-gray-100 text-gray-800",
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};
</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-2xl font-bold text-foreground">My Declarations</h1>
        <p class="text-muted-foreground mt-1">Track and manage your asset declarations</p>
      </div>
      <NuxtLink
        to="/applicant/declaration/new"
        class="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        New Declaration
      </NuxtLink>
    </div>

    <!-- Filters -->
    <div class="mb-6">
      <select
        v-model="statusFilter"
        class="px-4 py-2 border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <option value="">All Statuses</option>
        <option value="PENDING">Pending</option>
        <option value="SUBMITTED">Submitted</option>
        <option value="UNDER_REVIEW">Under Review</option>
        <option value="APPROVED">Approved</option>
        <option value="REJECTED">Rejected</option>
        <option value="SEALED">Sealed</option>
      </select>
    </div>

    <!-- Loading State -->
    <div v-if="pending" class="text-center py-12">
      <div class="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
      <p class="text-muted-foreground mt-4">Loading declarations...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="text-center py-12">
      <p class="text-destructive">Failed to load declarations</p>
      <button
        class="mt-4 text-primary hover:underline"
        @click="refresh()"
      >
        Try again
      </button>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="declarations.length === 0"
      class="text-center py-12 bg-card rounded-lg border"
    >
      <svg class="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <h3 class="text-lg font-medium text-foreground mb-2">No declarations found</h3>
      <p class="text-muted-foreground mb-6">
        {{ statusFilter ? 'No declarations match the selected filter' : 'Create your first asset declaration' }}
      </p>
      <NuxtLink
        v-if="!statusFilter"
        to="/applicant/declaration/new"
        class="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
      >
        Create Declaration
      </NuxtLink>
    </div>

    <!-- Declarations List -->
    <div v-else class="space-y-4">
      <NuxtLink
        v-for="declaration in declarations"
        :key="declaration.id"
        :to="`/applicant/declaration/${declaration.id}`"
        class="block p-6 bg-card rounded-lg border hover:border-primary/50 transition-colors"
      >
        <div class="flex items-start justify-between">
          <div>
            <div class="flex items-center gap-3 mb-2">
              <span class="font-mono font-bold text-lg text-foreground">
                {{ declaration.uniqueCode }}
              </span>
              <span
                class="px-2 py-1 rounded-full text-xs font-medium"
                :class="statusColors[declaration.status]"
              >
                {{ declaration.status.replace('_', ' ') }}
              </span>
            </div>
            <p class="text-sm text-muted-foreground">
              Created {{ formatDate(declaration.createdAt) }}
              <span v-if="declaration.submittedAt">
                • Submitted {{ formatDate(declaration.submittedAt) }}
              </span>
            </p>
          </div>
          <svg class="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </div>

        <!-- Latest Activity -->
        <div v-if="declaration.reviews?.length > 0" class="mt-4 pt-4 border-t">
          <p class="text-sm">
            <span class="text-muted-foreground">Latest Review:</span>
            <span
              class="ml-2 font-medium"
              :class="declaration.reviews[0].status === 'APPROVED' ? 'text-success' : 'text-destructive'"
            >
              {{ declaration.reviews[0].status }}
            </span>
            <span class="text-muted-foreground ml-2">
              on {{ formatDate(declaration.reviews[0].reviewDate) }}
            </span>
          </p>
        </div>
      </NuxtLink>

      <!-- Pagination -->
      <div
        v-if="pagination && pagination.totalPages > 1"
        class="flex items-center justify-center gap-2 mt-8"
      >
        <button
          :disabled="page <= 1"
          class="px-3 py-1 rounded border disabled:opacity-50"
          @click="page--"
        >
          Previous
        </button>
        <span class="text-sm text-muted-foreground">
          Page {{ pagination.page }} of {{ pagination.totalPages }}
        </span>
        <button
          :disabled="page >= pagination.totalPages"
          class="px-3 py-1 rounded border disabled:opacity-50"
          @click="page++"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>
