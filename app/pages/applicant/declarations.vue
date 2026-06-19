<script setup lang="ts">
import { FileText } from "lucide-vue-next";

interface DeclarationReview {
  status: string;
  reviewDate: string;
}

interface DeclarationListItem {
  id: string;
  uniqueCode: string;
  status: string;
  createdAt: string;
  submittedAt: string | null;
  reviews: DeclarationReview[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const page = ref(1);
const statusFilter = ref("ALL");

// Map the UI filter value to the API query parameter
const statusQuery = computed(() => statusFilter.value === "ALL" ? "" : statusFilter.value);

// Fetch declarations
const { data, pending, error, refresh } = await useAsyncData(
  "applicant-declarations",
  () => authFetch<{ data: { declarations: DeclarationListItem[]; pagination: Pagination } }>("/api/declarations", {
    query: { page: page.value, limit: 10, status: statusQuery.value },
  }),
  { watch: [page, statusQuery] },
);

const declarations = computed(() => data.value?.data?.declarations || []);
const pagination = computed(() => data.value?.data?.pagination);

const { isVerified } = useAuth();

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
    <PageHeader title="My Declarations" description="Track and manage your asset declarations">
      <template #actions>
        <Button
          as-child
          data-tour="declarations-new"
          :disabled="!isVerified"
          :class="{ 'opacity-50 pointer-events-none': !isVerified }"
        >
          <NuxtLink
            :to="isVerified ? '/applicant/declaration/new' : undefined"
            class="flex items-center gap-2"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            New Declaration
          </NuxtLink>
        </Button>
      </template>
    </PageHeader>

    <!-- Filters -->
    <div class="mb-6" data-tour="declarations-filter">
      <Select v-model="statusFilter">
        <SelectTrigger class="w-[200px]">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All Statuses</SelectItem>
          <SelectItem value="CODE_GENERATED">Code Generated</SelectItem>
          <SelectItem value="FORM_COLLECTED">Form Collected</SelectItem>
          <SelectItem value="SUBMITTED">Submitted</SelectItem>
          <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
          <SelectItem value="APPROVED">Approved</SelectItem>
          <SelectItem value="REJECTED">Rejected</SelectItem>
          <SelectItem value="SEALED">Sealed</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <!-- Loading State -->
    <div v-if="pending" class="space-y-4">
      <Card v-for="n in 3" :key="n">
        <CardContent class="p-6">
          <div class="flex items-start justify-between">
            <div class="space-y-3 flex-1">
              <div class="flex items-center gap-3">
                <Skeleton class="h-6 w-40" />
                <Skeleton class="h-5 w-20 rounded-full" />
              </div>
              <Skeleton class="h-4 w-56" />
            </div>
            <Skeleton class="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Error State -->
    <EmptyState v-else-if="error" title="Failed to load declarations">
      <template #action>
        <Button variant="link" @click="refresh()">
          Try again
        </Button>
      </template>
    </EmptyState>

    <!-- Empty State -->
    <EmptyState
      v-else-if="declarations.length === 0"
      :icon="FileText"
      title="No declarations found"
      :description="statusFilter !== 'ALL' ? 'No declarations match the selected filter' : 'Create your first asset declaration'"
    >
      <template v-if="statusFilter === 'ALL' && isVerified" #action>
        <Button as-child>
          <NuxtLink to="/applicant/declaration/new">
            Create Declaration
          </NuxtLink>
        </Button>
      </template>
    </EmptyState>

    <!-- Declarations List -->
    <div v-else class="space-y-4" data-tour="declarations-list">
      <NuxtLink
        v-for="declaration in declarations"
        :key="declaration.id"
        :to="`/applicant/declaration/${declaration.id}`"
        class="block"
      >
        <Card class="hover:border-primary/50 transition-colors">
          <CardContent class="p-6">
            <div class="flex items-start justify-between">
              <div>
                <div class="flex items-center gap-3 mb-2">
                  <span class="font-mono font-bold text-lg text-foreground">
                    {{ declaration.uniqueCode }}
                  </span>
                  <StatusBadge :status="declaration.status" />
                </div>
                <p class="text-sm text-muted-foreground">
                  Created {{ formatDate(declaration.createdAt) }}
                  <span v-if="declaration.submittedAt">
                    &bull; Submitted {{ formatDate(declaration.submittedAt) }}
                  </span>
                </p>
              </div>
              <svg class="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </div>

            <!-- Latest Activity -->
            <div v-if="declaration.reviews?.[0]" class="mt-4 pt-4 border-t">
              <p class="text-sm">
                <span class="text-muted-foreground">Latest Review:</span>
                <span
                  class="ml-2 font-medium"
                  :class="declaration.reviews[0]!.status === 'APPROVED' ? 'text-success' : 'text-destructive'"
                >
                  {{ declaration.reviews[0]!.status }}
                </span>
                <span class="text-muted-foreground ml-2">
                  on {{ formatDate(declaration.reviews[0]!.reviewDate) }}
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      </NuxtLink>

      <!-- Pagination -->
      <div
        v-if="pagination && pagination.totalPages > 1"
        data-tour="declarations-pagination"
        class="flex items-center justify-center gap-2 mt-8"
      >
        <Button
          variant="outline"
          size="sm"
          :disabled="page <= 1"
          @click="page--"
        >
          Previous
        </Button>
        <span class="text-sm text-muted-foreground">
          Page {{ pagination.page }} of {{ pagination.totalPages }}
        </span>
        <Button
          variant="outline"
          size="sm"
          :disabled="page >= pagination.totalPages"
          @click="page++"
        >
          Next
        </Button>
      </div>
    </div>
  </div>
</template>
