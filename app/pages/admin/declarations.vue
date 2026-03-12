<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";

definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const authStore = useAuthStore();

interface Declaration {
  id: string;
  uniqueCode: string;
  status: string;
  submittedAt: string | null;
  createdAt: string;
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

    const response = await $fetch(`/api/admin/declarations?${params}`, {
      headers: authStore.getAuthHeaders(),
    });

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

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    SUBMITTED: "bg-blue-100 text-blue-800",
    UNDER_REVIEW: "bg-orange-100 text-orange-800",
    APPROVED: "bg-green-100 text-green-800",
    REJECTED: "bg-red-100 text-red-800",
    SEALED: "bg-purple-100 text-purple-800",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
};

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
    await $fetch("/api/reviews", {
      method: "POST",
      headers: authStore.getAuthHeaders(),
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
  { value: "PENDING", label: "Pending" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "SEALED", label: "Sealed" },
];
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-foreground">All Declarations</h1>
        <p class="text-muted-foreground mt-1">
          View and manage all asset declarations
        </p>
      </div>
      <div class="text-sm text-muted-foreground">
        Total: {{ total }} declarations
      </div>
    </div>

    <!-- Filters -->
    <div class="bg-card border rounded-lg p-4">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search by code or name..."
          class="px-4 py-2 border rounded-md bg-background text-foreground"
          @keyup.enter="handleSearch"
        />
        <select
          v-model="selectedStatus"
          class="px-4 py-2 border rounded-md bg-background text-foreground"
          @change="handleSearch"
        >
          <option v-for="status in statuses" :key="status.value" :value="status.value">
            {{ status.label }}
          </option>
        </select>
        <input
          v-model="dateFrom"
          type="date"
          class="px-4 py-2 border rounded-md bg-background text-foreground"
          placeholder="From date"
          @change="handleSearch"
        />
        <input
          v-model="dateTo"
          type="date"
          class="px-4 py-2 border rounded-md bg-background text-foreground"
          placeholder="To date"
          @change="handleSearch"
        />
        <div class="flex gap-2">
          <button
            class="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            @click="handleSearch"
          >
            Search
          </button>
          <button
            class="px-4 py-2 border rounded-md hover:bg-muted"
            @click="clearFilters"
          >
            Clear
          </button>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-12">
      <div class="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
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
      <p class="text-muted-foreground">
        Try adjusting your search filters.
      </p>
    </div>

    <!-- Declarations Table -->
    <div v-else class="bg-card border rounded-lg overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-muted/50">
            <tr>
              <th class="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Code</th>
              <th class="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Applicant</th>
              <th class="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Institution</th>
              <th class="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
              <th class="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Submitted</th>
              <th class="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="declaration in declarations" :key="declaration.id" class="border-t hover:bg-muted/30">
              <td class="py-3 px-4">
                <span class="font-mono text-sm font-medium text-primary">
                  {{ declaration.uniqueCode }}
                </span>
              </td>
              <td class="py-3 px-4">
                <div>
                  <p class="text-sm font-medium text-foreground">{{ declaration.applicant.fullName }}</p>
                  <p class="text-xs text-muted-foreground">{{ declaration.applicant.ghanaCardNumber }}</p>
                </div>
              </td>
              <td class="py-3 px-4 text-sm text-muted-foreground">
                {{ declaration.applicant.institution?.name || '-' }}
              </td>
              <td class="py-3 px-4">
                <span
                  class="px-2 py-0.5 text-xs rounded-full"
                  :class="getStatusColor(declaration.status)"
                >
                  {{ declaration.status }}
                </span>
              </td>
              <td class="py-3 px-4 text-sm text-muted-foreground">
                {{ formatDate(declaration.submittedAt) }}
              </td>
              <td class="py-3 px-4">
                <div class="flex items-center gap-2">
                  <button
                    class="px-3 py-1 text-xs border rounded hover:bg-muted"
                    @click="openDetailModal(declaration)"
                  >
                    View
                  </button>
                  <template v-if="canReview(declaration)">
                    <button
                      class="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                      @click="openReviewModal(declaration, 'APPROVED')"
                    >
                      Approve
                    </button>
                    <button
                      class="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                      @click="openReviewModal(declaration, 'REJECTED')"
                    >
                      Reject
                    </button>
                  </template>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex items-center justify-between px-4 py-3 border-t">
        <p class="text-sm text-muted-foreground">
          Showing {{ (currentPage - 1) * limit + 1 }} to {{ Math.min(currentPage * limit, total) }} of {{ total }}
        </p>
        <div class="flex gap-2">
          <button
            class="px-3 py-1 text-sm border rounded hover:bg-muted disabled:opacity-50"
            :disabled="currentPage === 1"
            @click="handlePageChange(currentPage - 1)"
          >
            Previous
          </button>
          <button
            class="px-3 py-1 text-sm border rounded hover:bg-muted disabled:opacity-50"
            :disabled="currentPage === totalPages"
            @click="handlePageChange(currentPage + 1)"
          >
            Next
          </button>
        </div>
      </div>
    </div>

    <!-- Detail Modal -->
    <div
      v-if="showDetailModal && selectedDeclaration"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      @click.self="closeDetailModal"
    >
      <div class="bg-card border rounded-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div class="p-6 border-b flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold text-foreground">Declaration Details</h2>
            <p class="text-sm text-muted-foreground font-mono">{{ selectedDeclaration.uniqueCode }}</p>
          </div>
          <span
            class="px-3 py-1 text-sm rounded-full"
            :class="getStatusColor(selectedDeclaration.status)"
          >
            {{ selectedDeclaration.status }}
          </span>
        </div>

        <div class="p-6 space-y-6">
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
                  <p class="text-sm text-foreground">{{ selectedDeclaration.applicant.designation }}</p>
                </div>
                <div>
                  <p class="text-xs text-muted-foreground">Institution</p>
                  <p class="text-sm text-foreground">{{ selectedDeclaration.applicant.institution?.name || '-' }}</p>
                </div>
                <div class="col-span-2">
                  <p class="text-xs text-muted-foreground">Office Category</p>
                  <p class="text-sm text-foreground">{{ selectedDeclaration.applicant.officeCategory?.name || '-' }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Timeline -->
          <div>
            <h3 class="text-sm font-medium text-muted-foreground mb-3">Timeline</h3>
            <div class="space-y-3">
              <div class="flex items-start gap-3">
                <div class="w-2 h-2 mt-2 rounded-full bg-blue-500" />
                <div>
                  <p class="text-sm font-medium text-foreground">Created</p>
                  <p class="text-xs text-muted-foreground">{{ formatDate(selectedDeclaration.createdAt) }}</p>
                </div>
              </div>

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
              <button
                class="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                @click="openReviewModal(selectedDeclaration, 'APPROVED')"
              >
                Approve Declaration
              </button>
              <button
                class="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                @click="openReviewModal(selectedDeclaration, 'REJECTED')"
              >
                Reject Declaration
              </button>
            </div>
          </div>
        </div>

        <div class="p-6 border-t flex justify-end">
          <button
            class="px-4 py-2 text-sm border rounded-md hover:bg-muted"
            @click="closeDetailModal"
          >
            Close
          </button>
        </div>
      </div>
    </div>

    <!-- Review Modal -->
    <div
      v-if="showReviewModal && selectedDeclaration"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      @click.self="closeReviewModal"
    >
      <div class="bg-card border rounded-lg w-full max-w-lg mx-4">
        <div class="p-6 border-b">
          <h2 class="text-lg font-semibold text-foreground">
            {{ reviewStatus === 'APPROVED' ? 'Approve' : 'Reject' }} Declaration
          </h2>
          <p class="text-sm text-muted-foreground mt-1">
            {{ reviewStatus === 'APPROVED' ? 'Confirm approval of this declaration' : 'Provide reason for rejection' }}
          </p>
        </div>

        <div class="p-6 space-y-4">
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
            <label class="block text-sm font-medium text-foreground mb-1">
              Rejection Reason <span class="text-red-500">*</span>
            </label>
            <textarea
              v-model="rejectionReason"
              rows="3"
              placeholder="Explain why this declaration is being rejected..."
              class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-background text-foreground"
            />
            <p class="text-xs text-muted-foreground mt-1">
              A new unique code will be issued for resubmission.
            </p>
          </div>

          <div v-if="reviewError" class="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {{ reviewError }}
          </div>
        </div>

        <div class="p-6 border-t flex justify-end gap-3">
          <button
            class="px-4 py-2 text-sm border rounded-md hover:bg-muted"
            @click="closeReviewModal"
          >
            Cancel
          </button>
          <button
            :disabled="isReviewing"
            :class="[
              'px-4 py-2 text-sm rounded-md disabled:opacity-50',
              reviewStatus === 'APPROVED'
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-red-600 text-white hover:bg-red-700'
            ]"
            @click="submitReview"
          >
            {{ isReviewing ? 'Processing...' : (reviewStatus === 'APPROVED' ? 'Confirm Approval' : 'Confirm Rejection') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
