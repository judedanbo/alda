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
}

const pendingDeclarations = ref<Declaration[]>([]);
const total = ref(0);
const loading = ref(true);
const search = ref("");
const currentPage = ref(1);
const limit = 10;

const selectedDeclaration = ref<Declaration | null>(null);
const showRecordModal = ref(false);
const recordingNotes = ref("");
const isRecording = ref(false);
const recordError = ref("");

const fetchPendingSubmissions = async () => {
  loading.value = true;
  try {
    const query = new URLSearchParams({
      limit: String(limit),
      offset: String((currentPage.value - 1) * limit),
    });
    if (search.value) {
      query.set("search", search.value);
    }

    const response = await $fetch(`/api/submissions/pending?${query}`, {
      headers: authStore.getAuthHeaders(),
    });

    if (response.success) {
      pendingDeclarations.value = response.data.declarations as Declaration[];
      total.value = response.data.total;
    }
  } catch (error) {
    console.error("Failed to fetch pending submissions:", error);
  } finally {
    loading.value = false;
  }
};

await fetchPendingSubmissions();

watch([search, currentPage], fetchPendingSubmissions);

const openRecordModal = (declaration: Declaration) => {
  selectedDeclaration.value = declaration;
  recordingNotes.value = "";
  recordError.value = "";
  showRecordModal.value = true;
};

const recordSubmission = async () => {
  if (!selectedDeclaration.value) return;

  isRecording.value = true;
  recordError.value = "";

  try {
    await $fetch("/api/submissions", {
      method: "POST",
      headers: authStore.getAuthHeaders(),
      body: {
        declarationId: selectedDeclaration.value.id,
        notes: recordingNotes.value || undefined,
      },
    });

    showRecordModal.value = false;
    selectedDeclaration.value = null;
    await fetchPendingSubmissions();
  } catch (error: any) {
    recordError.value = error.data?.statusMessage || "Failed to record submission";
  } finally {
    isRecording.value = false;
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
        <h1 class="text-2xl font-bold text-foreground">Record Submissions</h1>
        <p class="text-muted-foreground mt-1">
          Record declarations submitted by applicants
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
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <h3 class="text-lg font-medium text-foreground mb-2">No pending submissions</h3>
      <p class="text-muted-foreground">
        All submitted declarations have been recorded.
      </p>
    </div>

    <!-- Submissions Table -->
    <div v-else class="bg-card border rounded-lg overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-muted/50">
            <tr>
              <th class="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Code</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Applicant</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Institution</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Submitted</th>
              <th class="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Action</th>
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
                  <p class="text-sm text-muted-foreground">{{ declaration.applicant.designation }}</p>
                </div>
              </td>
              <td class="px-4 py-3 text-sm text-muted-foreground">
                {{ declaration.applicant.institution?.name || 'N/A' }}
              </td>
              <td class="px-4 py-3 text-sm text-muted-foreground">
                {{ declaration.submittedAt ? formatDate(declaration.submittedAt) : '-' }}
              </td>
              <td class="px-4 py-3 text-right">
                <button
                  class="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
                  @click="openRecordModal(declaration)"
                >
                  Record
                </button>
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

    <!-- Record Modal -->
    <Teleport to="body">
      <div
        v-if="showRecordModal"
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        @click.self="showRecordModal = false"
      >
        <div class="bg-card rounded-lg w-full max-w-lg">
          <div class="p-6 border-b">
            <h2 class="text-xl font-semibold text-foreground">Record Submission</h2>
            <p class="text-sm text-muted-foreground mt-1">
              Confirm receipt of this declaration
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
                <span class="text-sm text-muted-foreground">Ghana Card:</span>
                <span>{{ selectedDeclaration.applicant.ghanaCardNumber }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-sm text-muted-foreground">Institution:</span>
                <span>{{ selectedDeclaration.applicant.institution?.name || 'N/A' }}</span>
              </div>
            </div>

            <!-- Notes -->
            <div>
              <label class="block text-sm font-medium text-foreground mb-1">
                Notes (optional)
              </label>
              <textarea
                v-model="recordingNotes"
                rows="3"
                placeholder="Any notes about this submission..."
                class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>

            <!-- Error -->
            <div v-if="recordError" class="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {{ recordError }}
            </div>
          </div>

          <div class="p-6 border-t flex justify-end gap-3">
            <button
              class="px-4 py-2 text-sm border rounded-lg hover:bg-muted"
              @click="showRecordModal = false"
            >
              Cancel
            </button>
            <button
              :disabled="isRecording"
              class="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
              @click="recordSubmission"
            >
              {{ isRecording ? 'Recording...' : 'Confirm & Record' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
