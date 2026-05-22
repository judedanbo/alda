<script setup lang="ts">
interface ProfileUser {
  email: string;
  phone: string | null;
  createdAt: string;
}

interface OfficeCategoryInfo {
  name: string;
  articleReference: string | null;
}

interface InstitutionInfo {
  name: string;
}

interface ProfileOffice {
  id: string;
  designation: string;
  officeCategory: OfficeCategoryInfo;
  institution: InstitutionInfo | null;
}

interface ProfileListItem {
  id: string;
  fullName: string;
  ghanaCardNumber: string;
  verificationStatus: string;
  createdAt: string;
  user: ProfileUser;
  offices: ProfileOffice[];
  verificationReviews: { id: string; status: string; createdAt: string; reviewer: { email: string } }[];
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
const statusFilter = ref((route.query.status as string) || "ALL");
const search = ref("");

const statusQuery = computed(() => statusFilter.value === "ALL" ? undefined : statusFilter.value);

const { data, pending, error, refresh } = await useAsyncData(
  "legal-verifications",
  () => authFetch<{ data: { profiles: ProfileListItem[]; pagination: PaginationInfo } }>("/api/legal/verifications", {
    query: {
      page: page.value,
      limit: 20,
      status: statusQuery.value,
      search: search.value || undefined,
    },
  }),
  { watch: [page, statusQuery, search] },
);

const profiles = computed(() => data.value?.data?.profiles || []);
const pagination = computed(() => data.value?.data?.pagination);

const statusColors: Record<string, string> = {
  PENDING_VERIFICATION: TONE_BADGE.amber,
  VERIFIED: TONE_BADGE.green,
  ON_HOLD: TONE_BADGE.orange,
  MORE_INFO_REQUIRED: TONE_BADGE.blue,
  REJECTED: TONE_BADGE.red,
};

const statusLabels: Record<string, string> = {
  PENDING_VERIFICATION: "Pending",
  VERIFIED: "Verified",
  ON_HOLD: "On Hold",
  MORE_INFO_REQUIRED: "More Info",
  REJECTED: "Rejected",
};

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="Applicant Verifications" description="Review and verify applicant registrations" />

    <!-- Filters -->
    <div class="flex flex-col sm:flex-row gap-4">
      <div class="flex-1">
        <input
          v-model="search"
          type="text"
          placeholder="Search by name, Ghana Card, or email..."
          class="w-full px-4 py-2 border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
      </div>
      <Select v-model="statusFilter">
        <SelectTrigger class="w-[220px]">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All Statuses</SelectItem>
          <SelectItem value="PENDING_VERIFICATION">Pending Review</SelectItem>
          <SelectItem value="ON_HOLD">On Hold</SelectItem>
          <SelectItem value="MORE_INFO_REQUIRED">More Info Required</SelectItem>
          <SelectItem value="VERIFIED">Verified</SelectItem>
          <SelectItem value="REJECTED">Rejected</SelectItem>
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
      <p class="text-destructive">Failed to load verifications</p>
      <Button variant="link" class="mt-4" @click="refresh()">Try again</Button>
    </div>

    <!-- Empty -->
    <Card v-else-if="profiles.length === 0" class="text-center py-12">
      <CardContent>
        <p class="text-muted-foreground">No verification requests found</p>
      </CardContent>
    </Card>

    <!-- List -->
    <div v-else class="space-y-3">
      <NuxtLink
        v-for="profile in profiles"
        :key="profile.id"
        :to="`/legal/verifications/${profile.id}`"
        class="block"
      >
        <Card class="hover:border-primary/50 transition-colors">
          <CardContent class="p-6">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  {{ profile.fullName?.charAt(0).toUpperCase() }}
                </div>
                <div>
                  <p class="font-medium text-foreground">{{ profile.fullName }}</p>
                  <p class="text-sm text-muted-foreground">
                    {{ profile.ghanaCardNumber }} &bull; {{ profile.user?.email }}
                  </p>
                  <p class="text-xs text-muted-foreground mt-1">
                    <template v-if="profile.offices?.[0]">
                      {{ profile.offices[0].officeCategory?.name }}
                      <span v-if="profile.offices[0].institution"> &bull; {{ profile.offices[0].institution.name }}</span>
                      &bull;
                    </template>
                    Registered {{ formatDate(profile.createdAt) }}
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <span
                  class="px-3 py-1 rounded-full text-xs font-medium"
                  :class="statusColors[profile.verificationStatus] || 'bg-muted text-muted-foreground'"
                >
                  {{ statusLabels[profile.verificationStatus] || profile.verificationStatus }}
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
