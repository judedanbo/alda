<script setup lang="ts">
definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

interface SectionReview {
  id: string;
  section: string;
  isAcceptable: boolean;
  comments: string | null;
  resolvedAt: string | null;
  resolvedById: string | null;
  reviewer: { email: string } | null;
  resolvedBy: { email: string } | null;
  createdAt: string;
}

interface Declaration {
  id: string;
  uniqueCode: string;
  status: string;
  submittedAt: string | null;
  applicant: {
    fullName: string;
    ghanaCardNumber: string;
    offices: Array<{
      id: string;
      designation: string;
      startDate: string;
      endDate: string | null;
      officeCategory: { name: string } | null;
      institution: { name: string } | null;
    }>;
    user: {
      email: string;
      phone: string | null;
    };
  };
  sectionReviews: Array<{ id: string; section: string }>;
}

const pendingDeclarations = ref<Declaration[]>([]);
const total = ref(0);
const loading = ref(true);
const search = ref("");
const currentPage = ref(1);
const limit = 10;

const selectedDeclaration = ref<Declaration | null>(null);
const showReviewPanel = ref(false);
const sectionReviews = ref<SectionReview[]>([]);
const loadingSections = ref(false);

const fetchPendingReviews = async () => {
  loading.value = true;
  try {
    const query = new URLSearchParams({
      limit: String(limit),
      offset: String((currentPage.value - 1) * limit),
    });
    if (search.value) {
      query.set("search", search.value);
    }

    const response = await authFetch<any>(`/api/reviews/pending?${query}`);

    if (response.success) {
      pendingDeclarations.value = response.data.declarations as Declaration[];
      total.value = response.data.total;
    }
  } catch (error) {
    console.error("Failed to fetch pending reviews:", error);
  } finally {
    loading.value = false;
  }
};

await fetchPendingReviews();

watch([search, currentPage], fetchPendingReviews);

const openReview = async (declaration: Declaration) => {
  selectedDeclaration.value = declaration;
  showReviewPanel.value = true;
  loadingSections.value = true;

  try {
    const response = await authFetch<any>(`/api/reviews/${declaration.id}/sections`);
    sectionReviews.value = response.data || [];
  } catch {
    sectionReviews.value = [];
  } finally {
    loadingSections.value = false;
  }
};

const onReviewed = async () => {
  showReviewPanel.value = false;
  selectedDeclaration.value = null;
  sectionReviews.value = [];
  await fetchPendingReviews();
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const totalPages = computed(() => Math.ceil(total.value / limit));
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <PageHeader title="Review Declarations" description="Review submitted declarations section by section">
      <template #actions>
        <Button variant="ghost" as-child>
          <NuxtLink to="/officer/dashboard">Back to Dashboard</NuxtLink>
        </Button>
      </template>
    </PageHeader>

    <!-- Review Panel -->
    <template v-if="showReviewPanel && selectedDeclaration">
      <div class="mb-4">
        <Button variant="ghost" @click="showReviewPanel = false; selectedDeclaration = null">
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back to List
        </Button>
      </div>

      <div v-if="loadingSections" class="space-y-4">
        <Card>
          <CardContent class="p-6">
            <Skeleton class="h-6 w-48 mb-4" />
            <div class="space-y-3">
              <Skeleton class="h-20 w-full" />
              <Skeleton class="h-20 w-full" />
              <Skeleton class="h-20 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>

      <AppSectionReviewForm
        v-else
        :declaration="selectedDeclaration"
        :existing-reviews="sectionReviews"
        @reviewed="onReviewed"
      />
    </template>

    <!-- List View -->
    <template v-else>
      <!-- Search -->
      <Card>
        <CardContent class="p-4">
          <Input
            v-model="search"
            type="text"
            placeholder="Search by code or applicant name..."
          />
        </CardContent>
      </Card>

      <!-- Loading -->
      <Card v-if="loading">
        <CardContent class="p-6">
          <div class="space-y-4">
            <Skeleton class="h-8 w-full" />
            <Skeleton class="h-8 w-full" />
            <Skeleton class="h-8 w-full" />
          </div>
        </CardContent>
      </Card>

      <!-- Empty State -->
      <Card v-else-if="pendingDeclarations.length === 0">
        <CardContent class="text-center py-12">
          <svg class="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <h3 class="text-lg font-medium text-foreground mb-2">No pending reviews</h3>
          <p class="text-muted-foreground">
            All submitted declarations have been reviewed.
          </p>
        </CardContent>
      </Card>

      <!-- Reviews Table -->
      <Card v-else>
        <CardContent class="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Applicant</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead class="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="declaration in pendingDeclarations"
                :key="declaration.id"
                class="hover:bg-muted/30"
              >
                <TableCell>
                  <span class="font-mono text-sm font-medium text-primary">
                    {{ declaration.uniqueCode }}
                  </span>
                </TableCell>
                <TableCell>
                  <div>
                    <p class="font-medium text-foreground">{{ declaration.applicant.fullName }}</p>
                    <p class="text-sm text-muted-foreground">{{ declaration.applicant.ghanaCardNumber }}</p>
                  </div>
                </TableCell>
                <TableCell class="text-sm text-muted-foreground">
                  {{ declaration.applicant.offices?.[0]?.officeCategory?.name || 'N/A' }}
                </TableCell>
                <TableCell class="text-sm text-muted-foreground">
                  {{ declaration.submittedAt ? formatDate(declaration.submittedAt) : 'N/A' }}
                </TableCell>
                <TableCell>
                  <Badge
                    v-if="declaration.sectionReviews.length > 0"
                    class="bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                  >
                    {{ declaration.sectionReviews.length }} issue(s)
                  </Badge>
                  <span v-else class="text-sm text-muted-foreground">New</span>
                </TableCell>
                <TableCell class="text-right">
                  <Button
                    size="sm"
                    @click="openReview(declaration)"
                  >
                    Review
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>

          <!-- Pagination -->
          <div
            v-if="totalPages > 1"
            class="flex items-center justify-between px-4 py-3 border-t"
          >
            <p class="text-sm text-muted-foreground">
              Showing {{ (currentPage - 1) * limit + 1 }} to {{ Math.min(currentPage * limit, total) }} of {{ total }}
            </p>
            <div class="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                :disabled="currentPage <= 1"
                @click="currentPage--"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                :disabled="currentPage >= totalPages"
                @click="currentPage++"
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </template>
  </div>
</template>
