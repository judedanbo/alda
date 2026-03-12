<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";

definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const authStore = useAuthStore();

interface Institution {
  id: string;
  name: string;
  type: string | null;
  isActive: boolean;
  _count: {
    applicantProfiles: number;
  };
}

const institutions = ref<Institution[]>([]);
const loading = ref(true);
const totalInstitutions = ref(0);
const currentPage = ref(1);
const perPage = 20;

const searchQuery = ref("");
const selectedStatus = ref("");

const showModal = ref(false);
const isEditing = ref(false);
const saving = ref(false);

const formData = ref({
  id: "",
  name: "",
  type: "",
  isActive: true,
});

const fetchInstitutions = async () => {
  loading.value = true;
  try {
    const params = new URLSearchParams({
      limit: perPage.toString(),
      offset: ((currentPage.value - 1) * perPage).toString(),
    });

    if (searchQuery.value) params.append("search", searchQuery.value);
    if (selectedStatus.value) params.append("status", selectedStatus.value);

    const response = await $fetch(`/api/admin/institutions?${params}`, {
      headers: authStore.getAuthHeaders(),
    });

    if (response.success) {
      institutions.value = response.data.institutions;
      totalInstitutions.value = response.data.total;
    }
  } catch (error) {
    console.error("Failed to fetch institutions:", error);
  } finally {
    loading.value = false;
  }
};

await fetchInstitutions();

const totalPages = computed(() => Math.ceil(totalInstitutions.value / perPage));

const openCreateModal = () => {
  isEditing.value = false;
  formData.value = { id: "", name: "", type: "", isActive: true };
  showModal.value = true;
};

const openEditModal = (institution: Institution) => {
  isEditing.value = true;
  formData.value = {
    id: institution.id,
    name: institution.name,
    type: institution.type || "",
    isActive: institution.isActive,
  };
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
  formData.value = { id: "", name: "", type: "", isActive: true };
};

const saveInstitution = async () => {
  saving.value = true;
  try {
    if (isEditing.value) {
      await $fetch(`/api/admin/institutions/${formData.value.id}`, {
        method: "PUT",
        headers: authStore.getAuthHeaders(),
        body: {
          name: formData.value.name,
          type: formData.value.type || null,
          isActive: formData.value.isActive,
        },
      });
    } else {
      await $fetch("/api/admin/institutions", {
        method: "POST",
        headers: authStore.getAuthHeaders(),
        body: {
          name: formData.value.name,
          type: formData.value.type || null,
        },
      });
    }
    await fetchInstitutions();
    closeModal();
  } catch (error) {
    console.error("Failed to save institution:", error);
  } finally {
    saving.value = false;
  }
};

const toggleStatus = async (institution: Institution) => {
  try {
    await $fetch(`/api/admin/institutions/${institution.id}`, {
      method: "PUT",
      headers: authStore.getAuthHeaders(),
      body: {
        name: institution.name,
        type: institution.type,
        isActive: !institution.isActive,
      },
    });
    institution.isActive = !institution.isActive;
  } catch (error) {
    console.error("Failed to toggle institution status:", error);
  }
};

const handleSearch = () => {
  currentPage.value = 1;
  fetchInstitutions();
};

const handlePageChange = (page: number) => {
  currentPage.value = page;
  fetchInstitutions();
};

const institutionTypes = [
  "Ministry",
  "Department",
  "Agency",
  "Commission",
  "Authority",
  "Corporation",
  "University",
  "Hospital",
  "District Assembly",
  "Metropolitan Assembly",
  "Municipal Assembly",
  "Other",
];
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-foreground">Institutions</h1>
        <p class="text-muted-foreground mt-1">
          Manage registered institutions
        </p>
      </div>
      <button
        class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        @click="openCreateModal"
      >
        Add Institution
      </button>
    </div>

    <!-- Filters -->
    <div class="bg-card border rounded-lg p-4">
      <div class="flex flex-col md:flex-row gap-4">
        <div class="flex-1">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search institutions..."
            class="w-full px-4 py-2 border rounded-md bg-background text-foreground"
            @keyup.enter="handleSearch"
          />
        </div>
        <select
          v-model="selectedStatus"
          class="px-4 py-2 border rounded-md bg-background text-foreground"
          @change="handleSearch"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button
          class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          @click="handleSearch"
        >
          Search
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-12">
      <div class="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>

    <!-- Institutions Table -->
    <div v-else class="bg-card border rounded-lg overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-muted/50">
            <tr>
              <th class="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Name</th>
              <th class="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Type</th>
              <th class="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Applicants</th>
              <th class="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
              <th class="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="institutions.length === 0">
              <td colspan="5" class="py-8 text-center text-muted-foreground">
                No institutions found
              </td>
            </tr>
            <tr v-for="institution in institutions" :key="institution.id" class="border-t">
              <td class="py-3 px-4">
                <p class="text-sm font-medium text-foreground">{{ institution.name }}</p>
              </td>
              <td class="py-3 px-4 text-sm text-muted-foreground">
                {{ institution.type || '-' }}
              </td>
              <td class="py-3 px-4 text-sm text-muted-foreground">
                {{ institution._count.applicantProfiles }}
              </td>
              <td class="py-3 px-4">
                <span
                  class="px-2 py-0.5 text-xs rounded-full"
                  :class="institution.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
                >
                  {{ institution.isActive ? 'Active' : 'Inactive' }}
                </span>
              </td>
              <td class="py-3 px-4">
                <div class="flex items-center gap-2">
                  <button
                    class="px-3 py-1 text-xs border rounded hover:bg-muted"
                    @click="openEditModal(institution)"
                  >
                    Edit
                  </button>
                  <button
                    class="px-3 py-1 text-xs border rounded hover:bg-muted"
                    :class="institution.isActive ? 'text-red-600' : 'text-green-600'"
                    @click="toggleStatus(institution)"
                  >
                    {{ institution.isActive ? 'Deactivate' : 'Activate' }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex items-center justify-between px-4 py-3 border-t">
        <p class="text-sm text-muted-foreground">
          Showing {{ (currentPage - 1) * perPage + 1 }} to {{ Math.min(currentPage * perPage, totalInstitutions) }} of {{ totalInstitutions }} institutions
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

    <!-- Create/Edit Modal -->
    <div
      v-if="showModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      @click.self="closeModal"
    >
      <div class="bg-card border rounded-lg p-6 w-full max-w-md mx-4">
        <h2 class="text-lg font-semibold text-foreground mb-4">
          {{ isEditing ? 'Edit Institution' : 'Add Institution' }}
        </h2>

        <div class="space-y-4 mb-6">
          <div>
            <label class="block text-sm font-medium text-foreground mb-1">
              Name <span class="text-red-500">*</span>
            </label>
            <input
              v-model="formData.name"
              type="text"
              class="w-full px-4 py-2 border rounded-md bg-background text-foreground"
              placeholder="Institution name"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-foreground mb-1">
              Type
            </label>
            <select
              v-model="formData.type"
              class="w-full px-4 py-2 border rounded-md bg-background text-foreground"
            >
              <option value="">Select type</option>
              <option v-for="type in institutionTypes" :key="type" :value="type">
                {{ type }}
              </option>
            </select>
          </div>

          <div v-if="isEditing" class="flex items-center gap-2">
            <input
              v-model="formData.isActive"
              type="checkbox"
              id="isActive"
              class="w-4 h-4"
            />
            <label for="isActive" class="text-sm text-foreground">Active</label>
          </div>
        </div>

        <div class="flex justify-end gap-3">
          <button
            class="px-4 py-2 text-sm border rounded-md hover:bg-muted"
            @click="closeModal"
          >
            Cancel
          </button>
          <button
            class="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            :disabled="saving || !formData.name"
            @click="saveInstitution"
          >
            {{ saving ? 'Saving...' : (isEditing ? 'Update' : 'Create') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
