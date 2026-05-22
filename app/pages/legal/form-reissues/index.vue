<script setup lang="ts">
interface ReissueApplicant {
  fullName: string;
  ghanaCardNumber: string;
  user: { email: string };
}

interface ReissueDeclaration {
  id: string;
  uniqueCode: string;
  applicant: ReissueApplicant;
}

interface ReissueRequestItem {
  id: string;
  status: string;
  applicantNote: string | null;
  createdAt: string;
  declaration: ReissueDeclaration;
  requestedBy: { email: string } | null;
  reviewedBy: { email: string } | null;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const route = useRoute();
const page = ref(1);
const statusFilter = ref((route.query.status as string) || "PENDING");
const search = ref("");

const { data, pending, error, refresh } = await useAsyncData(
  "legal-form-reissues",
  () => authFetch<{ data: { requests: ReissueRequestItem[]; pagination: PaginationInfo } }>("/api/legal/form-reissues", {
    query: {
      page: page.value,
      limit: 20,
      status: statusFilter.value,
      search: search.value || undefined,
    },
  }),
  { watch: [page, statusFilter, search] },
);

const requests = computed(() => data.value?.data?.requests || []);
const pagination = computed(() => data.value?.data?.pagination);

const statusColors: Record<string, string> = {
  PENDING: TONE_BADGE.amber,
  APPROVED: TONE_BADGE.green,
  DECLINED: TONE_BADGE.red,
};

const statusLabels: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  DECLINED: "Declined",
};

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="Form Reissue Requests" description="Review lost-form reissue requests and record Auditor General approvals" />

    <!-- Filters -->
    <div class="flex flex-col sm:flex-row gap-4">
      <div class="flex-1">
        <input
          v-model="search"
          type="text"
          placeholder="Search by declaration code, name, or Ghana Card..."
          class="w-full px-4 py-2 border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
      </div>
      <Select v-model="statusFilter">
        <SelectTrigger class="w-[220px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="PENDING">Pending</SelectItem>
          <SelectItem value="APPROVED">Approved</SelectItem>
          <SelectItem value="DECLINED">Declined</SelectItem>
          <SelectItem value="ALL">All</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <!-- Loading -->
    <div v-if="pending" class="space-y-4">
      <Card v-for="n in 3" :key="n">
        <CardContent class="p-6">
          <div class="flex items-center gap-4">
            <Skeleton class="h-12 w-12 rounded-full" />
            <div class="flex-1 space-y-2">
              <Skeleton class="h-5 w-48" />
              <Skeleton class="h-4 w-32" />
            </div>
            <Skeleton class="h-6 w-20 rounded-full" />
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="text-center py-12">
      <p class="text-destructive">Failed to load reissue requests</p>
      <Button variant="link" class="mt-4" @click="refresh()">Try again</Button>
    </div>

    <!-- Empty -->
    <Card v-else-if="requests.length === 0" class="text-center py-12">
      <CardContent>
        <p class="text-muted-foreground">No reissue requests found</p>
      </CardContent>
    </Card>

    <!-- List -->
    <div v-else class="space-y-3">
      <NuxtLink
        v-for="request in requests"
        :key="request.id"
        :to="`/legal/form-reissues/${request.id}`"
        class="block"
      >
        <Card class="hover:border-primary/50 transition-colors">
          <CardContent class="p-6">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  {{ request.declaration?.applicant?.fullName?.charAt(0).toUpperCase() }}
                </div>
                <div>
                  <p class="font-medium text-foreground">
                    {{ request.declaration?.applicant?.fullName }}
                    <span class="font-mono text-sm text-primary ml-2">{{ request.declaration?.uniqueCode }}</span>
                  </p>
                  <p class="text-sm text-muted-foreground">
                    {{ request.declaration?.applicant?.ghanaCardNumber }}
                    &bull; {{ request.declaration?.applicant?.user?.email }}
                  </p>
                  <p class="text-xs text-muted-foreground mt-1">
                    Requested {{ formatDate(request.createdAt) }}
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <span
                  class="px-3 py-1 rounded-full text-xs font-medium"
                  :class="statusColors[request.status] || 'bg-muted text-muted-foreground'"
                >
                  {{ statusLabels[request.status] || request.status }}
                </span>
                <svg class="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>
      </NuxtLink>
    </div>

    <!-- Pagination -->
    <div
      v-if="pagination && pagination.totalPages > 1"
      class="flex items-center justify-center gap-2 mt-8"
    >
      <Button variant="outline" size="sm" :disabled="page <= 1" @click="page--">Previous</Button>
      <span class="text-sm text-muted-foreground">
        Page {{ pagination.page }} of {{ pagination.totalPages }}
      </span>
      <Button variant="outline" size="sm" :disabled="page >= pagination.totalPages" @click="page++">Next</Button>
    </div>
  </div>
</template>
