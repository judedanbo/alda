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

    const response = await $fetch(`/api/reviews/pending?${query}`, {
      headers: authStore.getAuthHeaders(),
    });

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
    await $fetch("/api/reviews", {
      method: "POST",
      headers: authStore.getAuthHeaders(),
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
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-foreground">Review Declarations</h1>
        <p class="text-muted-foreground mt-1">
          Approve or reject submitted declarations
        </p>
      </div>
      <NuxtLink
        to="/officer/dashboard"
        class="text-sm text-primary hover:underline"
      >
        Back to Dashboard
      </NuxtLink>
    </div>

    <!-- Search -->
    <div class="bg-card border rounded-lg p-4">
      <div class="flex gap-4">
        <div class="flex-1">
          <input
            v-model="search"
            type="text"
            placeholder="Search by code or applicant name..."
            class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-12">
      <div class="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>

    <!-- Empty State -->
    <div
      v-else-if="pendingDeclarations.length === 0"
      class="text-center py-12 bg-card rounded-lg border"
    >
      <svg class="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
      <h3 class="text-lg font-medium text-foreground mb-2">No pending reviews</h3>
      <p class="text-muted-foreground">
        All declarations under review have been processed.
      </p>
    </div>

    <!-- Reviews Table -->
    <div v-else class="bg-card border rounded-lg overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-muted/50">
            <tr>
              <th class="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Code</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Applicant</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Category</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Recorded</th>
              <th class="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            <tr
              v-for="declaration in pendingDeclarations"
              :key="declaration.id"
              class="hover:bg-muted/30"
            >
              <td class="px-4 py-3">
                <span class="font-mono text-sm font-medium text-primary">
                  {{ declaration.uniqueCode }}
                </span>
              </td>
              <td class="px-4 py-3">
                <div>
                  <p class="font-medium text-foreground">{{ declaration.applicant.fullName }}</p>
                  <p class="text-sm text-muted-foreground">{{ declaration.applicant.ghanaCardNumber }}</p>
                </div>
              </td>
              <td class="px-4 py-3 text-sm text-muted-foreground">
                {{ declaration.applicant.officeCategory?.name || 'N/A' }}
              </td>
              <td class="px-4 py-3 text-sm text-muted-foreground">
                {{ declaration.submissions[0] ? formatDate(declaration.submissions[0].submissionDate) : 'N/A' }}
              </td>
              <td class="px-4 py-3 text-right">
                <div class="flex justify-end gap-2">
                  <button
                    class="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                    @click="openReviewModal(declaration, 'APPROVED')"
                  >
                    Approve
                  </button>
                  <button
                    class="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                    @click="openReviewModal(declaration, 'REJECTED')"
                  >
                    Reject
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div
        v-if="totalPages > 1"
        class="flex items-center justify-between px-4 py-3 border-t"
      >
        <p class="text-sm text-muted-foreground">
          Showing {{ (currentPage - 1) * limit + 1 }} to {{ Math.min(currentPage * limit, total) }} of {{ total }}
        </p>
        <div class="flex gap-2">
          <button
            :disabled="currentPage <= 1"
            class="px-3 py-1 text-sm border rounded disabled:opacity-50"
            @click="currentPage--"
          >
            Previous
          </button>
          <button
            :disabled="currentPage >= totalPages"
            class="px-3 py-1 text-sm border rounded disabled:opacity-50"
            @click="currentPage++"
          >
            Next
          </button>
        </div>
      </div>
    </div>

    <!-- Review Modal -->
    <Teleport to="body">
      <div
        v-if="showReviewModal"
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        @click.self="showReviewModal = false"
      >
        <div class="bg-card rounded-lg w-full max-w-lg">
          <div class="p-6 border-b">
            <h2 class="text-xl font-semibold text-foreground">
              {{ reviewStatus === 'APPROVED' ? 'Approve' : 'Reject' }} Declaration
            </h2>
            <p class="text-sm text-muted-foreground mt-1">
              {{ reviewStatus === 'APPROVED' ? 'Confirm approval of this declaration' : 'Provide reason for rejection' }}
            </p>
          </div>

          <div v-if="selectedDeclaration" class="p-6 space-y-4">
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

            <!-- Rejection Reason -->
            <div v-if="reviewStatus === 'REJECTED'">
              <label class="block text-sm font-medium text-foreground mb-1">
                Rejection Reason <span class="text-red-500">*</span>
              </label>
              <textarea
                v-model="rejectionReason"
                rows="3"
                placeholder="Explain why this declaration is being rejected..."
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                required
              />
              <p class="text-xs text-muted-foreground mt-1">
                A new unique code will be issued for resubmission.
              </p>
            </div>

            <!-- Error -->
            <div v-if="reviewError" class="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {{ reviewError }}
            </div>
          </div>

          <div class="p-6 border-t flex justify-end gap-3">
            <button
              class="px-4 py-2 text-sm border rounded-lg hover:bg-muted"
              @click="showReviewModal = false"
            >
              Cancel
            </button>
            <button
              :disabled="isReviewing"
              :class="[
                'px-4 py-2 text-sm rounded-lg disabled:opacity-50',
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
    </Teleport>
  </div>
</template>
