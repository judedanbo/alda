<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";

definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const authStore = useAuthStore();

interface Category {
  id: number;
  name: string;
  description: string | null;
  articleReference: string | null;
  isActive: boolean;
}

const categories = ref<Category[]>([]);
const loading = ref(true);

const showModal = ref(false);
const isEditing = ref(false);
const saving = ref(false);
const errorMessage = ref("");

const formData = ref({
  id: 0,
  name: "",
  description: "",
  articleReference: "",
  isActive: true,
});

const fetchCategories = async () => {
  loading.value = true;
  try {
    const response = await $fetch(
      "/api/admin/categories?includeInactive=true",
      {
        headers: authStore.getAuthHeaders(),
      }
    );

    if (response.success) {
      categories.value = response.data;
    }
  } catch (error) {
    console.error("Failed to fetch categories:", error);
  } finally {
    loading.value = false;
  }
};

await fetchCategories();

const openCreateModal = () => {
  isEditing.value = false;
  errorMessage.value = "";
  formData.value = {
    id: 0,
    name: "",
    description: "",
    articleReference: "",
    isActive: true,
  };
  showModal.value = true;
};

const openEditModal = (category: Category) => {
  isEditing.value = true;
  errorMessage.value = "";
  formData.value = {
    id: category.id,
    name: category.name,
    description: category.description || "",
    articleReference: category.articleReference || "",
    isActive: category.isActive,
  };
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
  errorMessage.value = "";
  formData.value = {
    id: 0,
    name: "",
    description: "",
    articleReference: "",
    isActive: true,
  };
};

const saveCategory = async () => {
  saving.value = true;
  errorMessage.value = "";
  try {
    if (isEditing.value) {
      await $fetch(`/api/admin/categories/${formData.value.id}`, {
        method: "PUT",
        headers: authStore.getAuthHeaders(),
        body: {
          name: formData.value.name,
          description: formData.value.description || null,
          articleReference: formData.value.articleReference || null,
          isActive: formData.value.isActive,
        },
      });
    } else {
      await $fetch("/api/admin/categories", {
        method: "POST",
        headers: authStore.getAuthHeaders(),
        body: {
          name: formData.value.name,
          description: formData.value.description || null,
          articleReference: formData.value.articleReference || null,
        },
      });
    }
    await fetchCategories();
    closeModal();
  } catch (error: unknown) {
    const err = error as { data?: { message?: string }; statusMessage?: string };
    errorMessage.value =
      err.data?.message || err.statusMessage || "Failed to save category";
  } finally {
    saving.value = false;
  }
};

const toggleStatus = async (category: Category) => {
  try {
    if (category.isActive) {
      // Deactivate via DELETE endpoint (soft-delete)
      await $fetch(`/api/admin/categories/${category.id}`, {
        method: "DELETE",
        headers: authStore.getAuthHeaders(),
      });
      category.isActive = false;
    } else {
      // Reactivate via PUT endpoint
      await $fetch(`/api/admin/categories/${category.id}`, {
        method: "PUT",
        headers: authStore.getAuthHeaders(),
        body: {
          isActive: true,
        },
      });
      category.isActive = true;
    }
  } catch (error) {
    console.error("Failed to toggle category status:", error);
  }
};
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-foreground">
          Public Office Categories
        </h1>
        <p class="text-muted-foreground mt-1">
          Manage public office categories for Article 286 declarations
        </p>
      </div>
      <button
        class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        @click="openCreateModal"
      >
        Add Category
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-12">
      <div
        class="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
      />
    </div>

    <!-- Categories Table -->
    <div v-else class="bg-card border rounded-lg overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-muted/50">
            <tr>
              <th
                class="text-left py-3 px-4 text-sm font-medium text-muted-foreground"
              >
                Name
              </th>
              <th
                class="text-left py-3 px-4 text-sm font-medium text-muted-foreground"
              >
                Article Reference
              </th>
              <th
                class="text-left py-3 px-4 text-sm font-medium text-muted-foreground"
              >
                Description
              </th>
              <th
                class="text-left py-3 px-4 text-sm font-medium text-muted-foreground"
              >
                Status
              </th>
              <th
                class="text-left py-3 px-4 text-sm font-medium text-muted-foreground"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="categories.length === 0">
              <td
                colspan="5"
                class="py-8 text-center text-muted-foreground"
              >
                No categories found
              </td>
            </tr>
            <tr
              v-for="category in categories"
              :key="category.id"
              class="border-t"
            >
              <td class="py-3 px-4">
                <p class="text-sm font-medium text-foreground">
                  {{ category.name }}
                </p>
              </td>
              <td class="py-3 px-4 text-sm text-muted-foreground">
                {{ category.articleReference || "-" }}
              </td>
              <td class="py-3 px-4 text-sm text-muted-foreground max-w-xs truncate">
                {{ category.description || "-" }}
              </td>
              <td class="py-3 px-4">
                <span
                  class="px-2 py-0.5 text-xs rounded-full"
                  :class="
                    category.isActive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  "
                >
                  {{ category.isActive ? "Active" : "Inactive" }}
                </span>
              </td>
              <td class="py-3 px-4">
                <div class="flex items-center gap-2">
                  <button
                    class="px-3 py-1 text-xs border rounded hover:bg-muted"
                    @click="openEditModal(category)"
                  >
                    Edit
                  </button>
                  <button
                    class="px-3 py-1 text-xs border rounded hover:bg-muted"
                    :class="
                      category.isActive
                        ? 'text-red-600'
                        : 'text-green-600'
                    "
                    @click="toggleStatus(category)"
                  >
                    {{ category.isActive ? "Deactivate" : "Activate" }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
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
          {{ isEditing ? "Edit Category" : "Add Category" }}
        </h2>

        <div v-if="errorMessage" class="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {{ errorMessage }}
        </div>

        <div class="space-y-4 mb-6">
          <div>
            <label class="block text-sm font-medium text-foreground mb-1">
              Name <span class="text-red-500">*</span>
            </label>
            <input
              v-model="formData.name"
              type="text"
              class="w-full px-4 py-2 border rounded-md bg-background text-foreground"
              placeholder="Category name"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-foreground mb-1">
              Article Reference
            </label>
            <input
              v-model="formData.articleReference"
              type="text"
              class="w-full px-4 py-2 border rounded-md bg-background text-foreground"
              placeholder="e.g. Article 286(1)(a)"
              maxlength="50"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-foreground mb-1">
              Description
            </label>
            <textarea
              v-model="formData.description"
              class="w-full px-4 py-2 border rounded-md bg-background text-foreground"
              placeholder="Brief description of this category"
              rows="3"
              maxlength="500"
            />
          </div>

          <div v-if="isEditing" class="flex items-center gap-2">
            <input
              id="isActive"
              v-model="formData.isActive"
              type="checkbox"
              class="w-4 h-4"
            />
            <label for="isActive" class="text-sm text-foreground"
              >Active</label
            >
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
            @click="saveCategory"
          >
            {{ saving ? "Saving..." : isEditing ? "Update" : "Create" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
