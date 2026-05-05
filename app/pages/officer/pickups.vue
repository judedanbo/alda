<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";

definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const authStore = useAuthStore();

interface Pickup {
  id: string;
  isSelfPickup: boolean;
  authorizedName: string;
  authorizedPhone: string | null;
  pickedUp: boolean;
  pickupDate: string | null;
  createdAt: string;
  declaration: {
    id: string;
    uniqueCode: string;
    applicant: {
      fullName: string;
      institution: { name: string } | null;
    };
    receipts: {
      receiptNumber: string;
    }[];
  };
}

const pendingPickups = ref<Pickup[]>([]);
const total = ref(0);
const loading = ref(true);
const search = ref("");
const currentPage = ref(1);
const limit = 10;

const selectedPickup = ref<Pickup | null>(null);
const showPickupModal = ref(false);
const isRecording = ref(false);
const recordError = ref("");

const fetchPendingPickups = async () => {
  loading.value = true;
  try {
    const query = new URLSearchParams({
      limit: String(limit),
      offset: String((currentPage.value - 1) * limit),
    });
    if (search.value) {
      query.set("search", search.value);
    }

    const response = await $fetch(`/api/pickup/pending?${query}`, {
      headers: authStore.getAuthHeaders(),
    });

    if (response.success) {
      pendingPickups.value = response.data.pickups as Pickup[];
      total.value = response.data.total;
    }
  } catch (error) {
    console.error("Failed to fetch pending pickups:", error);
  } finally {
    loading.value = false;
  }
};

await fetchPendingPickups();

watch([search, currentPage], fetchPendingPickups);

const openPickupModal = (pickup: Pickup) => {
  selectedPickup.value = pickup;
  recordError.value = "";
  showPickupModal.value = true;
};

const recordPickup = async () => {
  if (!selectedPickup.value) return;

  isRecording.value = true;
  recordError.value = "";

  try {
    await $fetch(`/api/pickup/${selectedPickup.value.declaration.id}`, {
      method: "PATCH",
      headers: authStore.getAuthHeaders(),
    });

    showPickupModal.value = false;
    selectedPickup.value = null;
    await fetchPendingPickups();
  } catch (error: any) {
    recordError.value = error.data?.statusMessage || "Failed to record pickup";
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
        <h1 class="text-2xl font-bold text-foreground">Manage Pickups</h1>
        <p class="text-muted-foreground mt-1">Record receipt pickups</p>
      </div>
      <NuxtLink to="/officer/dashboard" class="text-sm text-primary hover:underline">Back to Dashboard</NuxtLink>
    </div>

    <!-- Search -->
    <div class="bg-card border rounded-lg p-4">
      <input
        v-model="search"
        type="text"
        placeholder="Search by name or receipt number..."
        class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
      />
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-12">
      <div class="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>

    <!-- Empty State -->
    <div v-else-if="pendingPickups.length === 0" class="text-center py-12 bg-card rounded-lg border">
      <svg class="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
      </svg>
      <h3 class="text-lg font-medium text-foreground mb-2">No pending pickups</h3>
      <p class="text-muted-foreground">All receipts have been picked up.</p>
    </div>

    <!-- Pickups Table -->
    <div v-else class="bg-card border rounded-lg overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-muted/50">
            <tr>
              <th class="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Receipt</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Applicant</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Authorized Person</th>
              <th class="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Scheduled</th>
              <th class="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            <tr v-for="pickup in pendingPickups" :key="pickup.id" class="hover:bg-muted/30">
              <td class="px-4 py-3">
                <span class="font-mono text-sm font-medium text-primary">{{ pickup.declaration.receipts[0]?.receiptNumber }}</span>
                <p class="text-xs text-muted-foreground">{{ pickup.declaration.uniqueCode }}</p>
              </td>
              <td class="px-4 py-3">
                <p class="font-medium text-foreground">{{ pickup.declaration.applicant.fullName }}</p>
                <p class="text-sm text-muted-foreground">{{ pickup.declaration.applicant.institution?.name || 'N/A' }}</p>
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                  <span
                    :class="[
                      'px-2 py-0.5 text-xs rounded-full',
                      pickup.isSelfPickup ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                    ]"
                  >
                    {{ pickup.isSelfPickup ? 'Self' : 'Third Party' }}
                  </span>
                  <span class="text-sm">{{ pickup.authorizedName }}</span>
                </div>
                <p v-if="pickup.authorizedPhone" class="text-xs text-muted-foreground">{{ pickup.authorizedPhone }}</p>
              </td>
              <td class="px-4 py-3 text-sm text-muted-foreground">{{ formatDate(pickup.createdAt) }}</td>
              <td class="px-4 py-3 text-right">
                <button
                  class="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                  @click="openPickupModal(pickup)"
                >
                  Record Pickup
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

    <!-- Pickup Modal -->
    <Teleport to="body">
      <div v-if="showPickupModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" @click.self="showPickupModal = false">
        <div class="bg-card rounded-lg w-full max-w-lg">
          <div class="p-6 border-b">
            <h2 class="text-xl font-semibold text-foreground">Confirm Pickup</h2>
            <p class="text-sm text-muted-foreground mt-1">Record that this receipt has been collected</p>
          </div>

          <div v-if="selectedPickup" class="p-6 space-y-4">
            <div class="bg-muted/30 rounded-lg p-4 space-y-2">
              <div class="flex justify-between">
                <span class="text-sm text-muted-foreground">Receipt:</span>
                <span class="font-mono font-medium">{{ selectedPickup.declaration.receipts[0]?.receiptNumber }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-sm text-muted-foreground">Applicant:</span>
                <span class="font-medium">{{ selectedPickup.declaration.applicant.fullName }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-sm text-muted-foreground">Collecting:</span>
                <span>{{ selectedPickup.authorizedName }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-sm text-muted-foreground">Type:</span>
                <span :class="selectedPickup.isSelfPickup ? 'text-blue-600' : 'text-orange-600'">
                  {{ selectedPickup.isSelfPickup ? 'Self Pickup' : 'Third Party' }}
                </span>
              </div>
            </div>

            <div class="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p class="text-sm text-yellow-700">
                Please verify the identity of the person collecting the receipt before confirming.
                {{ !selectedPickup.isSelfPickup ? 'Ensure they have valid authorization from the applicant.' : '' }}
              </p>
            </div>

            <div v-if="recordError" class="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {{ recordError }}
            </div>
          </div>

          <div class="p-6 border-t flex justify-end gap-3">
            <button class="px-4 py-2 text-sm border rounded-lg hover:bg-muted" @click="showPickupModal = false">Cancel</button>
            <button
              :disabled="isRecording"
              class="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              @click="recordPickup"
            >
              {{ isRecording ? 'Recording...' : 'Confirm Pickup' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
