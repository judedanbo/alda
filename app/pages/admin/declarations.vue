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
  createdAt: string;
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
  formCollection: {
    collectedAt: string;
    officeName: string;
    notes: string | null;
  } | null;
  formReissues: Array<{
    id: string;
    status: string;
    createdAt: string;
    reviewedAt: string | null;
    approverType: string | null;
    approverDetail: string | null;
    decisionReason: string | null;
  }>;
  submission: {
    submissionDate: string;
    notes: string | null;
    recorder: { email: string };
  } | null;
  review: {
    status: string;
    reviewDate: string;
    rejectionReason: string | null;
    reviewer: { email: string };
  } | null;
  receipt: {
    receiptNumber: string;
    createdAt: string;
  } | null;
}

const declarations = ref<Declaration[]>([]);
const total = ref(0);
const loading = ref(true);
const currentPage = ref(1);
const limit = 20;

// Filters
const searchQuery = ref("");
const selectedStatus = ref("");
const dateFrom = ref("");
const dateTo = ref("");

// Detail modal
const selectedDeclaration = ref<Declaration | null>(null);
const showDetailModal = ref(false);

// Review modal
const showReviewModal = ref(false);
const reviewStatus = ref<"APPROVED" | "REJECTED">("APPROVED");
const rejectionReason = ref("");
const isReviewing = ref(false);
const reviewError = ref("");

const fetchDeclarations = async () => {
  loading.value = true;
  try {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: ((currentPage.value - 1) * limit).toString(),
    });

    if (searchQuery.value) params.append("search", searchQuery.value);
    if (selectedStatus.value) params.append("status", selectedStatus.value);
    if (dateFrom.value) params.append("dateFrom", dateFrom.value);
    if (dateTo.value) params.append("dateTo", dateTo.value);

    const response = await authFetch<any>(`/api/admin/declarations?${params}`);

    if (response.success) {
      declarations.value = response.data.declarations;
      total.value = response.data.total;
    }
  } catch (error) {
    console.error("Failed to fetch declarations:", error);
  } finally {
    loading.value = false;
  }
};

await fetchDeclarations();

const totalPages = computed(() => Math.ceil(total.value / limit));

const formatDate = (dateString: string | null) => {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const handleSearch = () => {
  currentPage.value = 1;
  fetchDeclarations();
};

const handlePageChange = (page: number) => {
  currentPage.value = page;
  fetchDeclarations();
};

const clearFilters = () => {
  searchQuery.value = "";
  selectedStatus.value = "";
  dateFrom.value = "";
  dateTo.value = "";
  currentPage.value = 1;
  fetchDeclarations();
};

const openDetailModal = (declaration: Declaration) => {
  selectedDeclaration.value = declaration;
  showDetailModal.value = true;
};

const closeDetailModal = () => {
  showDetailModal.value = false;
  selectedDeclaration.value = null;
};

const openReviewModal = (declaration: Declaration, status: "APPROVED" | "REJECTED") => {
  selectedDeclaration.value = declaration;
  reviewStatus.value = status;
  rejectionReason.value = "";
  reviewError.value = "";
  showReviewModal.value = true;
};

const closeReviewModal = () => {
  showReviewModal.value = false;
  reviewError.value = "";
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

    closeReviewModal();
    closeDetailModal();
    await fetchDeclarations();
  } catch (error: unknown) {
    const err = error as { data?: { statusMessage?: string } };
    reviewError.value = err.data?.statusMessage || "Failed to submit review";
  } finally {
    isReviewing.value = false;
  }
};

const canReview = (declaration: Declaration) => {
  return declaration.status === "UNDER_REVIEW";
};

const statuses = [
  { value: "", label: "All Statuses" },
  { value: "CODE_GENERATED", label: "Code Generated" },
  { value: "FORM_COLLECTED", label: "Form Collected" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "SEALED", label: "Sealed" },
];
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="All Declarations" description="View and manage all asset declarations">
      <template #actions>
        <span class="text-sm text-muted-foreground">Total: {{ total }} declarations</span>
      </template>
    </PageHeader>

    <!-- Filters -->
    <Card>
      <CardContent class="pt-6">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Input
            v-model="searchQuery"
            type="text"
            placeholder="Search by code or name..."
            @keyup.enter="handleSearch"
          />
          <Select v-model="selectedStatus" @update:model-value="handleSearch">
            <SelectTrigger>
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="status in statuses" :key="status.value" :value="status.value || 'all'">
                {{ status.label }}
              </SelectItem>
            </SelectContent>
          </Select>
          <Input
            v-model="dateFrom"
            type="date"
            placeholder="From date"
            @change="handleSearch"
          />
          <Input
            v-model="dateTo"
            type="date"
            placeholder="To date"
            @change="handleSearch"
          />
          <div class="flex gap-2">
            <Button class="flex-1" @click="handleSearch">Search</Button>
            <Button variant="outline" @click="clearFilters">Clear</Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Loading -->
    <div v-if="loading" class="space-y-3">
      <Skeleton v-for="i in 5" :key="i" class="h-12 w-full rounded-lg" />
    </div>

    <!-- Empty State -->
    <Card v-else-if="declarations.length === 0" class="py-12">
      <CardContent class="text-center">
        <svg class="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 class="text-lg font-medium text-foreground mb-2">No declarations found</h3>
        <p class="text-muted-foreground">Try adjusting your search filters.</p>
      </CardContent>
    </Card>

    <!-- Declarations Table -->
    <Card v-else>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Applicant</TableHead>
            <TableHead>Institution</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="declaration in declarations" :key="declaration.id">
            <TableCell>
              <span class="font-mono text-sm font-medium text-primary">
                {{ declaration.uniqueCode }}
              </span>
            </TableCell>
            <TableCell>
              <div>
                <p class="text-sm font-medium text-foreground">{{ declaration.applicant.fullName }}</p>
                <p class="text-xs text-muted-foreground">{{ declaration.applicant.ghanaCardNumber }}</p>
              </div>
            </TableCell>
            <TableCell class="text-sm text-muted-foreground">
              {{ declaration.applicant.offices?.[0]?.institution?.name || '-' }}
            </TableCell>
            <TableCell>
              <StatusBadge :status="declaration.status" />
            </TableCell>
            <TableCell class="text-sm text-muted-foreground">
              {{ formatDate(declaration.submittedAt) }}
            </TableCell>
            <TableCell>
              <div class="flex items-center gap-2">
                <Button variant="outline" size="sm" @click="openDetailModal(declaration)">
                  View
                </Button>
                <template v-if="canReview(declaration)">
                  <Button size="sm" class="bg-green-600 hover:bg-green-700" @click="openReviewModal(declaration, 'APPROVED')">
                    Approve
                  </Button>
                  <Button variant="destructive" size="sm" @click="openReviewModal(declaration, 'REJECTED')">
                    Reject
                  </Button>
                </template>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex items-center justify-between px-4 py-3 border-t">
        <p class="text-sm text-muted-foreground">
          Showing {{ (currentPage - 1) * limit + 1 }} to {{ Math.min(currentPage * limit, total) }} of {{ total }}
        </p>
        <div class="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            :disabled="currentPage === 1"
            @click="handlePageChange(currentPage - 1)"
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            :disabled="currentPage === totalPages"
            @click="handlePageChange(currentPage + 1)"
          >
            Next
          </Button>
        </div>
      </div>
    </Card>

    <!-- Detail Modal -->
    <Dialog :open="showDetailModal && !!selectedDeclaration" @update:open="(v: boolean) => { if (!v) closeDetailModal() }">
      <DialogScrollContent v-if="selectedDeclaration" class="max-w-2xl">
        <DialogHeader>
          <div class="flex items-center justify-between">
            <div>
              <DialogTitle>Declaration Details</DialogTitle>
              <DialogDescription class="font-mono">{{ selectedDeclaration.uniqueCode }}</DialogDescription>
            </div>
            <StatusBadge :status="selectedDeclaration.status" />
          </div>
        </DialogHeader>

        <div class="space-y-6">
          <!-- Applicant Info -->
          <div>
            <h3 class="text-sm font-medium text-muted-foreground mb-3">Applicant Information</h3>
            <div class="bg-muted/30 rounded-lg p-4 space-y-2">
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <p class="text-xs text-muted-foreground">Full Name</p>
                  <p class="text-sm font-medium text-foreground">{{ selectedDeclaration.applicant.fullName }}</p>
                </div>
                <div>
                  <p class="text-xs text-muted-foreground">Ghana Card</p>
                  <p class="text-sm font-medium text-foreground">{{ selectedDeclaration.applicant.ghanaCardNumber }}</p>
                </div>
                <div>
                  <p class="text-xs text-muted-foreground">Email</p>
                  <p class="text-sm text-foreground">{{ selectedDeclaration.applicant.user.email }}</p>
                </div>
                <div>
                  <p class="text-xs text-muted-foreground">Phone</p>
                  <p class="text-sm text-foreground">{{ selectedDeclaration.applicant.user.phone || '-' }}</p>
                </div>
                <div>
                  <p class="text-xs text-muted-foreground">Designation</p>
                  <p class="text-sm text-foreground">{{ selectedDeclaration.applicant.offices?.[0]?.designation || '-' }}</p>
                </div>
                <div>
                  <p class="text-xs text-muted-foreground">Institution</p>
                  <p class="text-sm text-foreground">{{ selectedDeclaration.applicant.offices?.[0]?.institution?.name || '-' }}</p>
                </div>
                <div class="col-span-2">
                  <p class="text-xs text-muted-foreground">Office Category</p>
                  <p class="text-sm text-foreground">{{ selectedDeclaration.applicant.offices?.[0]?.officeCategory?.name || '-' }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Timeline -->
          <div>
            <h3 class="text-sm font-medium text-muted-foreground mb-3">Timeline</h3>
            <div class="space-y-3">
              <div class="flex items-start gap-3">
                <div class="w-2 h-2 mt-2 rounded-full bg-amber-500" />
                <div>
                  <p class="text-sm font-medium text-foreground">Initiated</p>
                  <p class="text-xs text-muted-foreground">{{ formatDate(selectedDeclaration.createdAt) }}</p>
                </div>
              </div>

              <div v-if="selectedDeclaration.formCollection" class="flex items-start gap-3">
                <div class="w-2 h-2 mt-2 rounded-full bg-cyan-500" />
                <div>
                  <p class="text-sm font-medium text-foreground">Form Collected</p>
                  <p class="text-xs text-muted-foreground">
                    {{ formatDate(selectedDeclaration.formCollection.collectedAt) }}
                    from {{ selectedDeclaration.formCollection.officeName }}
                  </p>
                  <p v-if="selectedDeclaration.formCollection.notes" class="text-xs text-muted-foreground mt-1">
                    Notes: {{ selectedDeclaration.formCollection.notes }}
                  </p>
                </div>
              </div>

              <template v-for="reissue in selectedDeclaration.formReissues" :key="reissue.id">
                <div class="flex items-start gap-3">
                  <div class="w-2 h-2 mt-2 rounded-full bg-amber-500" />
                  <div>
                    <p class="text-sm font-medium text-foreground">Form Reissue Requested</p>
                    <p class="text-xs text-muted-foreground">{{ formatDate(reissue.createdAt) }}</p>
                  </div>
                </div>
                <div v-if="reissue.reviewedAt && reissue.status !== 'PENDING'" class="flex items-start gap-3">
                  <div
                    class="w-2 h-2 mt-2 rounded-full"
                    :class="reissue.status === 'APPROVED' ? 'bg-green-500' : 'bg-red-500'"
                  />
                  <div>
                    <p class="text-sm font-medium text-foreground">
                      {{ reissue.status === 'APPROVED' ? 'Form Reissue Approved' : 'Form Reissue Declined' }}
                    </p>
                    <p class="text-xs text-muted-foreground">{{ formatDate(reissue.reviewedAt) }}</p>
                    <p v-if="reissue.status === 'APPROVED'" class="text-xs text-muted-foreground mt-1">
                      Approved by {{ reissue.approverType }}<span v-if="reissue.approverDetail"> ({{ reissue.approverDetail }})</span>
                    </p>
                    <p v-else-if="reissue.decisionReason" class="text-xs text-muted-foreground mt-1">
                      Reason: {{ reissue.decisionReason }}
                    </p>
                  </div>
                </div>
              </template>

              <div v-if="selectedDeclaration.submittedAt" class="flex items-start gap-3">
                <div class="w-2 h-2 mt-2 rounded-full bg-blue-500" />
                <div>
                  <p class="text-sm font-medium text-foreground">Submitted</p>
                  <p class="text-xs text-muted-foreground">{{ formatDate(selectedDeclaration.submittedAt) }}</p>
                </div>
              </div>

              <div v-if="selectedDeclaration.submission" class="flex items-start gap-3">
                <div class="w-2 h-2 mt-2 rounded-full bg-orange-500" />
                <div>
                  <p class="text-sm font-medium text-foreground">Recorded by Officer</p>
                  <p class="text-xs text-muted-foreground">
                    {{ formatDate(selectedDeclaration.submission.submissionDate) }}
                    by {{ selectedDeclaration.submission.recorder.email }}
                  </p>
                  <p v-if="selectedDeclaration.submission.notes" class="text-xs text-muted-foreground mt-1">
                    Notes: {{ selectedDeclaration.submission.notes }}
                  </p>
                </div>
              </div>

              <div v-if="selectedDeclaration.review" class="flex items-start gap-3">
                <div
                  class="w-2 h-2 mt-2 rounded-full"
                  :class="selectedDeclaration.review.status === 'APPROVED' ? 'bg-green-500' : 'bg-red-500'"
                />
                <div>
                  <p class="text-sm font-medium text-foreground">
                    {{ selectedDeclaration.review.status === 'APPROVED' ? 'Approved' : 'Rejected' }}
                  </p>
                  <p class="text-xs text-muted-foreground">
                    {{ formatDate(selectedDeclaration.review.reviewDate) }}
                    by {{ selectedDeclaration.review.reviewer.email }}
                  </p>
                  <p v-if="selectedDeclaration.review.rejectionReason" class="text-xs text-red-600 mt-1">
                    Reason: {{ selectedDeclaration.review.rejectionReason }}
                  </p>
                </div>
              </div>

              <div v-if="selectedDeclaration.receipt" class="flex items-start gap-3">
                <div class="w-2 h-2 mt-2 rounded-full bg-purple-500" />
                <div>
                  <p class="text-sm font-medium text-foreground">Receipt Generated</p>
                  <p class="text-xs text-muted-foreground">
                    {{ formatDate(selectedDeclaration.receipt.createdAt) }}
                  </p>
                  <p class="text-xs font-mono text-primary">
                    {{ selectedDeclaration.receipt.receiptNumber }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Actions for UNDER_REVIEW status -->
          <div v-if="canReview(selectedDeclaration)" class="pt-4 border-t">
            <h3 class="text-sm font-medium text-muted-foreground mb-3">Review Actions</h3>
            <div class="flex gap-3">
              <Button class="flex-1 bg-green-600 hover:bg-green-700" @click="openReviewModal(selectedDeclaration, 'APPROVED')">
                Approve Declaration
              </Button>
              <Button variant="destructive" class="flex-1" @click="openReviewModal(selectedDeclaration, 'REJECTED')">
                Reject Declaration
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="closeDetailModal">Close</Button>
        </DialogFooter>
      </DialogScrollContent>
    </Dialog>

    <!-- Review Modal -->
    <Dialog :open="showReviewModal && !!selectedDeclaration" @update:open="(v: boolean) => { if (!v) closeReviewModal() }">
      <DialogContent v-if="selectedDeclaration" class="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {{ reviewStatus === 'APPROVED' ? 'Approve' : 'Reject' }} Declaration
          </DialogTitle>
          <DialogDescription>
            {{ reviewStatus === 'APPROVED' ? 'Confirm approval of this declaration' : 'Provide reason for rejection' }}
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-4">
          <div class="bg-muted/30 rounded-lg p-4 space-y-2">
            <div class="flex justify-between">
              <span class="text-sm text-muted-foreground">Code:</span>
              <span class="font-mono font-medium">{{ selectedDeclaration.uniqueCode }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-sm text-muted-foreground">Applicant:</span>
              <span class="font-medium">{{ selectedDeclaration.applicant.fullName }}</span>
            </div>
          </div>

          <div
            :class="[
              'p-4 rounded-lg border-2',
              reviewStatus === 'APPROVED' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
            ]"
          >
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
                class="w-5 h-5 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span :class="reviewStatus === 'APPROVED' ? 'text-green-700' : 'text-red-700'" class="font-medium">
                {{ reviewStatus === 'APPROVED' ? 'Approving this declaration' : 'Rejecting this declaration' }}
              </span>
            </div>
          </div>

          <div v-if="reviewStatus === 'REJECTED'">
            <Label for="rejection-reason">
              Rejection Reason <span class="text-red-500">*</span>
            </Label>
            <Textarea
              id="rejection-reason"
              v-model="rejectionReason"
              :rows="3"
              placeholder="Explain why this declaration is being rejected..."
              class="mt-1"
            />
            <p class="text-xs text-muted-foreground mt-1">
              A new unique code will be issued for resubmission.
            </p>
          </div>

          <Alert v-if="reviewError" variant="destructive">
            <AlertDescription>{{ reviewError }}</AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="closeReviewModal">Cancel</Button>
          <Button
            :disabled="isReviewing"
            :class="reviewStatus === 'APPROVED' ? 'bg-green-600 hover:bg-green-700' : ''"
            :variant="reviewStatus === 'REJECTED' ? 'destructive' : 'default'"
            @click="submitReview"
          >
            {{ isReviewing ? 'Processing...' : (reviewStatus === 'APPROVED' ? 'Confirm Approval' : 'Confirm Rejection') }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
