<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";

definePageMeta({
  layout: "dashboard",
  middleware: "auth",
});

const authStore = useAuthStore();

interface User {
  id: string;
  email: string;
  phone: string | null;
  emailVerified: boolean;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  roles: string[];
  profile: {
    fullName: string;
    ghanaCardNumber: string;
    designation: string;
    institution: string | null;
  } | null;
}

interface Role {
  id: number;
  name: string;
  description: string | null;
}

const users = ref<User[]>([]);
const roles = ref<Role[]>([]);
const loading = ref(true);
const totalUsers = ref(0);
const currentPage = ref(1);
const perPage = 20;

const searchQuery = ref("");
const selectedRole = ref("");
const selectedStatus = ref("");

const showEditModal = ref(false);
const editingUser = ref<User | null>(null);
const selectedRoles = ref<number[]>([]);
const saving = ref(false);

const fetchUsers = async () => {
  loading.value = true;
  try {
    const params = new URLSearchParams({
      limit: perPage.toString(),
      offset: ((currentPage.value - 1) * perPage).toString(),
    });

    if (searchQuery.value) params.append("search", searchQuery.value);
    if (selectedRole.value) params.append("role", selectedRole.value);
    if (selectedStatus.value) params.append("status", selectedStatus.value);

    const response = await $fetch(`/api/admin/users?${params}`, {
      headers: authStore.getAuthHeaders(),
    });

    if (response.success) {
      users.value = response.data.users;
      totalUsers.value = response.data.total;
    }
  } catch (error) {
    console.error("Failed to fetch users:", error);
  } finally {
    loading.value = false;
  }
};

const fetchRoles = async () => {
  try {
    const response = await $fetch("/api/admin/roles", {
      headers: authStore.getAuthHeaders(),
    });

    if (response.success) {
      roles.value = response.data.roles;
    }
  } catch (error) {
    console.error("Failed to fetch roles:", error);
  }
};

await Promise.all([fetchUsers(), fetchRoles()]);

const totalPages = computed(() => Math.ceil(totalUsers.value / perPage));

const openEditModal = (user: User) => {
  editingUser.value = user;
  selectedRoles.value = roles.value
    .filter((r) => user.roles.includes(r.name))
    .map((r) => r.id);
  showEditModal.value = true;
};

const closeEditModal = () => {
  showEditModal.value = false;
  editingUser.value = null;
  selectedRoles.value = [];
};

const saveUserRoles = async () => {
  if (!editingUser.value) return;

  saving.value = true;
  try {
    const response = await $fetch(`/api/admin/users/${editingUser.value.id}/roles`, {
      method: "PUT",
      headers: authStore.getAuthHeaders(),
      body: { roleIds: selectedRoles.value },
    });

    if (response.success) {
      await fetchUsers();
      closeEditModal();
    }
  } catch (error) {
    console.error("Failed to update user roles:", error);
  } finally {
    saving.value = false;
  }
};

const toggleUserStatus = async (user: User) => {
  try {
    const response = await $fetch(`/api/admin/users/${user.id}/status`, {
      method: "PATCH",
      headers: authStore.getAuthHeaders(),
      body: { isActive: !user.isActive },
    });

    if (response.success) {
      user.isActive = !user.isActive;
    }
  } catch (error) {
    console.error("Failed to toggle user status:", error);
  }
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return "Never";
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
  fetchUsers();
};

const handlePageChange = (page: number) => {
  currentPage.value = page;
  fetchUsers();
};
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-foreground">User Management</h1>
        <p class="text-muted-foreground mt-1">
          Manage system users and their roles
        </p>
      </div>
    </div>

    <!-- Filters -->
    <div class="bg-card border rounded-lg p-4">
      <div class="flex flex-col md:flex-row gap-4">
        <div class="flex-1">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search by email or name..."
            class="w-full px-4 py-2 border rounded-md bg-background text-foreground"
            @keyup.enter="handleSearch"
          />
        </div>
        <select
          v-model="selectedRole"
          class="px-4 py-2 border rounded-md bg-background text-foreground"
          @change="handleSearch"
        >
          <option value="">All Roles</option>
          <option v-for="role in roles" :key="role.id" :value="role.name">
            {{ role.name }}
          </option>
        </select>
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

    <!-- Users Table -->
    <div v-else class="bg-card border rounded-lg overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-muted/50">
            <tr>
              <th class="text-left py-3 px-4 text-sm font-medium text-muted-foreground">User</th>
              <th class="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Roles</th>
              <th class="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
              <th class="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Last Login</th>
              <th class="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Created</th>
              <th class="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="users.length === 0">
              <td colspan="6" class="py-8 text-center text-muted-foreground">
                No users found
              </td>
            </tr>
            <tr v-for="user in users" :key="user.id" class="border-t">
              <td class="py-3 px-4">
                <div>
                  <p class="text-sm font-medium text-foreground">{{ user.email }}</p>
                  <p v-if="user.profile" class="text-xs text-muted-foreground">
                    {{ user.profile.fullName }}
                  </p>
                </div>
              </td>
              <td class="py-3 px-4">
                <div class="flex flex-wrap gap-1">
                  <span
                    v-for="role in user.roles"
                    :key="role"
                    class="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary"
                  >
                    {{ role }}
                  </span>
                </div>
              </td>
              <td class="py-3 px-4">
                <span
                  class="px-2 py-0.5 text-xs rounded-full"
                  :class="user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
                >
                  {{ user.isActive ? 'Active' : 'Inactive' }}
                </span>
              </td>
              <td class="py-3 px-4 text-sm text-muted-foreground">
                {{ formatDate(user.lastLoginAt) }}
              </td>
              <td class="py-3 px-4 text-sm text-muted-foreground">
                {{ formatDate(user.createdAt) }}
              </td>
              <td class="py-3 px-4">
                <div class="flex items-center gap-2">
                  <button
                    class="px-3 py-1 text-xs border rounded hover:bg-muted"
                    @click="openEditModal(user)"
                  >
                    Edit Roles
                  </button>
                  <button
                    class="px-3 py-1 text-xs border rounded hover:bg-muted"
                    :class="user.isActive ? 'text-red-600' : 'text-green-600'"
                    @click="toggleUserStatus(user)"
                  >
                    {{ user.isActive ? 'Deactivate' : 'Activate' }}
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
          Showing {{ (currentPage - 1) * perPage + 1 }} to {{ Math.min(currentPage * perPage, totalUsers) }} of {{ totalUsers }} users
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

    <!-- Edit Roles Modal -->
    <div
      v-if="showEditModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      @click.self="closeEditModal"
    >
      <div class="bg-card border rounded-lg p-6 w-full max-w-md mx-4">
        <h2 class="text-lg font-semibold text-foreground mb-4">
          Edit User Roles
        </h2>
        <p class="text-sm text-muted-foreground mb-4">
          {{ editingUser?.email }}
        </p>

        <div class="space-y-3 mb-6">
          <label
            v-for="role in roles"
            :key="role.id"
            class="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
          >
            <input
              v-model="selectedRoles"
              type="checkbox"
              :value="role.id"
              class="w-4 h-4"
            />
            <div>
              <p class="text-sm font-medium text-foreground">{{ role.name }}</p>
              <p v-if="role.description" class="text-xs text-muted-foreground">
                {{ role.description }}
              </p>
            </div>
          </label>
        </div>

        <div class="flex justify-end gap-3">
          <button
            class="px-4 py-2 text-sm border rounded-md hover:bg-muted"
            @click="closeEditModal"
          >
            Cancel
          </button>
          <button
            class="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            :disabled="saving"
            @click="saveUserRoles"
          >
            {{ saving ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
