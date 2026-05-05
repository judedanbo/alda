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
  };
  reviews: {
    reviewDate: string;
    reviewer: { email: string };
  }[];
}

const pendingDeclarations = ref<Declaration[]>([]);
const total = ref(0);
const loading = ref(true);
const currentPage = ref(1);
const limit = 10;

const selectedDeclaration = ref<Declaration | null>(null);
const isGenerating = ref(false);
const generateError = ref("");
const showGenerateModal = ref(false);

const fetchPendingReceipts = async () => {
  loading.value = true;
  try {
    const query = new URLSearchParams({
      limit: String(limit),
      offset: String((currentPage.value - 1) * limit),
    });

    const response = await $fetch(`/api/receipts/pending?${query}`, {
      headers: authStore.getAuthHeaders(),
    });

    if (response.success) {
      pendingDeclarations.value = response.data.declarations as Declaration[];
      total.value = response.data.total;
    }
  } catch (error) {
    console.error("Failed to fetch pending receipts:", error);
  } finally {
    loading.value = false;
  }
};

await fetchPendingReceipts();

watch(currentPage, fetchPendingReceipts);

const openGenerateModal = (declaration: Declaration) => {
  selectedDeclaration.value = declaration;
  generateError.value = "";
  showGenerateModal.value = true;
};

const generateReceipt = async () => {
  if (!selectedDeclaration.value) return;

  isGenerating.value = true;
  generateError.value = "";

  try {
    const response = await $fetch(`/api/receipts/${selectedDeclaration.value.id}`, {
      method: "POST",
      headers: authStore.getAuthHeaders(),
    });

    type GenerateResponse = { success: boolean; data: { receipt: { pdfUrl: string | null } } };
    const typed = response as GenerateResponse;
    if (typed.success && typed.data.receipt.pdfUrl) {
      window.open(typed.data.receipt.pdfUrl, "_blank");
    }

    showGenerateModal.value = false;
    selectedDeclaration.value = null;
    await fetchPendingReceipts();
  } catch (error: any) {
    generateError.value = error.data?.statusMessage || "Failed to generate receipt";
  } finally {
    isGenerating.value = false;
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
        <h1 class="text-2xl font-bold text-foreground">Generate Receipts</h1>
        <p class="text-muted-foreground mt-1">
          Generate receipts for approved declarations
        </p>
      </div>
      <NuxtLink to="/officer/dashboard" class="text-sm text-primary hover:underline">
        Back to Dashboard
      </NuxtLink>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-12">
      <div class="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>

    <!-- Empty State -->
    <div v-else-if="pendingDeclarations.length === 0" class="text-center py-12 bg-card rounded-lg border">
      <svg class="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
      <h3 class="text-lg font-medium text-foreground mb-2">No pending receipts</h3>
      <p class="text-muted-foreground">All approved declarations have receipts generated.</p>
    </div>

    <!-- Table -->
    <div v-else class="bg-card border rounded-lg overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-muted/50">
            <tr>
              <th class="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Code</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Applicant</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Institution</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Approved</th>
              <th class="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            <tr v-for="declaration in pendingDeclarations" :key="declaration.id" class="hover:bg-muted/30">
              <td class="px-4 py-3">
                <span class="font-mono text-sm font-medium text-primary">{{ declaration.uniqueCode }}</span>
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
                {{ declaration.reviews[0] ? formatDate(declaration.reviews[0].reviewDate) : 'N/A' }}
              </td>
              <td class="px-4 py-3 text-right">
                <button
                  class="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700"
                  @click="openGenerateModal(declaration)"
                >
                  Generate
                </button>
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
          <button :disabled="currentPage <= 1" class="px-3 py-1 text-sm border rounded disabled:opacity-50" @click="currentPage--">Previous</button>
          <button :disabled="currentPage >= totalPages" class="px-3 py-1 text-sm border rounded disabled:opacity-50" @click="currentPage++">Next</button>
        </div>
      </div>
    </div>

    <!-- Generate Modal -->
    <Teleport to="body">
      <div v-if="showGenerateModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" @click.self="showGenerateModal = false">
        <div class="bg-card rounded-lg w-full max-w-lg">
          <div class="p-6 border-b">
            <h2 class="text-xl font-semibold text-foreground">Generate Receipt</h2>
            <p class="text-sm text-muted-foreground mt-1">Generate official receipt for this declaration</p>
          </div>

          <div v-if="selectedDeclaration" class="p-6 space-y-4">
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
            </div>

            <div class="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <p class="text-sm text-purple-700">
                This will generate an official PDF receipt and notify the applicant via email and SMS.
              </p>
            </div>

            <div v-if="generateError" class="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {{ generateError }}
            </div>
          </div>

          <div class="p-6 border-t flex justify-end gap-3">
            <button class="px-4 py-2 text-sm border rounded-lg hover:bg-muted" @click="showGenerateModal = false">Cancel</button>
            <button
              :disabled="isGenerating"
              class="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              @click="generateReceipt"
            >
              {{ isGenerating ? 'Generating...' : 'Generate Receipt' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
