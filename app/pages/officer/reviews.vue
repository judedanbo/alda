<script setup lang="ts">
definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

interface Declaration {
  id: string;
  uniqueCode: string;
  status: string;
  submittedAt: string | null;
  applicant: {
    fullName: string;
    ghanaCardNumber: string;
    designation: string;
    institution: { name: string } | null;
    officeCategory: { name: string } | null;
    user: {
      email: string;
      phone: string | null;
    };
  };
  submissions: {
    submissionDate: string;
    notes: string | null;
    recorder: {
      email: string;
    };
  }[];
}

const pendingDeclarations = ref<Declaration[]>([]);
const total = ref(0);
const loading = ref(true);
const search = ref("");
const currentPage = ref(1);
const limit = 10;

const selectedDeclaration = ref<Declaration | null>(null);
const showReviewModal = ref(false);
const reviewStatus = ref<"APPROVED" | "REJECTED">("APPROVED");
const rejectionReason = ref("");
const isReviewing = ref(false);
const reviewError = ref("");

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

const openReviewModal = (declaration: Declaration, status: "APPROVED" | "REJECTED") => {
  selectedDeclaration.value = declaration;
  reviewStatus.value = status;
  rejectionReason.value = "";
  reviewError.value = "";
  showReviewModal.value = true;
};

const submitReview = async () => {
  if (!selectedDeclaration.value) return;

  if (reviewStatus.value === "REJECTED" && !rejectionReason.value.trim()) {
    reviewError.value = "Please provide a reason for rejection";
    return;
  }

  isReviewing.value = true;
  reviewError.value = "";

  try {
    await authFetch("/api/reviews", {
      method: "POST",
      body: {
        declarationId: selectedDeclaration.value.id,
        status: reviewStatus.value,
        rejectionReason: reviewStatus.value === "REJECTED" ? rejectionReason.value : undefined,
      },
    });

    showReviewModal.value = false;
    selectedDeclaration.value = null;
    await fetchPendingReviews();
  } catch (error: any) {
    reviewError.value = error.data?.statusMessage || "Failed to submit review";
  } finally {
    isReviewing.value = false;
  }
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
    <PageHeader title="Review Declarations" description="Approve or reject submitted declarations">
      <template #actions>
        <Button variant="ghost" as-child>
          <NuxtLink to="/officer/dashboard">Back to Dashboard</NuxtLink>
        </Button>
      </template>
    </PageHeader>

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
          All declarations under review have been processed.
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
              <TableHead>Recorded</TableHead>
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
                {{ declaration.applicant.officeCategory?.name || 'N/A' }}
              </TableCell>
              <TableCell class="text-sm text-muted-foreground">
                {{ declaration.submissions[0] ? formatDate(declaration.submissions[0].submissionDate) : 'N/A' }}
              </TableCell>
              <TableCell class="text-right">
                <div class="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    @click="openReviewModal(declaration, 'APPROVED')"
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    @click="openReviewModal(declaration, 'REJECTED')"
                  >
                    Reject
                  </Button>
                </div>
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

    <!-- Review Modal -->
    <Dialog :open="showReviewModal" @update:open="showReviewModal = $event">
      <DialogContent class="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {{ reviewStatus === 'APPROVED' ? 'Approve' : 'Reject' }} Declaration
          </DialogTitle>
          <DialogDescription>
            {{ reviewStatus === 'APPROVED' ? 'Confirm approval of this declaration' : 'Provide reason for rejection' }}
          </DialogDescription>
        </DialogHeader>

        <div v-if="selectedDeclaration" class="space-y-4">
          <!-- Declaration Details -->
          <div class="bg-muted/30 rounded-lg p-4 space-y-2">
            <div class="flex justify-between">
              <span class="text-sm text-muted-foreground">Code:</span>
              <span class="font-mono font-medium">{{ selectedDeclaration.uniqueCode }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-muted-foreground">Applicant:</span>
              <span class="font-medium">{{ selectedDeclaration.applicant.fullName }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-muted-foreground">Institution:</span>
              <span>{{ selectedDeclaration.applicant.institution?.name || 'N/A' }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-muted-foreground">Category:</span>
              <span>{{ selectedDeclaration.applicant.officeCategory?.name || 'N/A' }}</span>
            </div>
          </div>

          <!-- Status indicator -->
          <Alert :variant="reviewStatus === 'APPROVED' ? 'default' : 'destructive'">
            <AlertDescription>
              <div class="flex items-center gap-2">
                <svg
                  v-if="reviewStatus === 'APPROVED'"
                  class="w-5 h-5 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                <svg
                  v-else
                  class="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span class="font-medium">
                  {{ reviewStatus === 'APPROVED' ? 'Approving this declaration' : 'Rejecting this declaration' }}
                </span>
              </div>
            </AlertDescription>
          </Alert>

          <!-- Rejection Reason -->
          <div v-if="reviewStatus === 'REJECTED'" class="space-y-2">
            <Label>
              Rejection Reason <span class="text-red-500">*</span>
            </Label>
            <Textarea
              v-model="rejectionReason"
              rows="3"
              placeholder="Explain why this declaration is being rejected..."
              required
            />
            <p class="text-xs text-muted-foreground">
              A new unique code will be issued for resubmission.
            </p>
          </div>

          <!-- Error -->
          <Alert v-if="reviewError" variant="destructive">
            <AlertDescription>{{ reviewError }}</AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="showReviewModal = false">Cancel</Button>
          <Button
            :disabled="isReviewing"
            :variant="reviewStatus === 'APPROVED' ? 'default' : 'destructive'"
            @click="submitReview"
          >
            {{ isReviewing ? 'Processing...' : (reviewStatus === 'APPROVED' ? 'Confirm Approval' : 'Confirm Rejection') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
